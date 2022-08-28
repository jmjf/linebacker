// mock the Azure SDK
jest.mock('@azure/storage-queue');
import * as mockQueueSDK from '@azure/storage-queue';

import { ReceivedMessageItem } from '@azure/storage-queue';

import { delay } from '../../utils/utils';
import { UniqueIdentifier } from '../../common/domain/UniqueIdentifier';

import { RequestTransportTypeValues } from '../domain/RequestTransportType';
import { RequestStatusTypeValues } from '../domain/RequestStatusType';

import { BackupJob, IBackupJobProps } from '../../backup-job/domain/BackupJob';
import { MockBackupJobServiceAdapter } from '../../backup-job/adapter/impl/MockBackupJobServiceAdapter';

import { SendRequestToInterfaceUseCase } from '../use-cases/send-request-to-interface/SendRequestToInterfaceUseCase';
import { BackupRequestAllowedSubscriber } from '../use-cases/send-request-to-interface/BackupRequestAllowedSubscriber';

import { BackupRequestCreatedSubscriber } from '../use-cases/check-request-allowed/BackupRequestCreatedSubscriber';
import { CheckRequestAllowedUseCase } from '../use-cases/check-request-allowed/CheckRequestAllowedUseCase';
import { CreateBackupRequestUseCase } from '../use-cases/create-backup-request/CreateBackupRequestUseCase';

import { StoreStatusReceivedSubscriber } from '../use-cases/receive-store-status-reply/StoreStatusReceivedSubscriber';
import { ReceiveStoreStatusReplyUseCase } from '../use-cases/receive-store-status-reply/ReceiveStoreStatusReplyUseCase';

import { AzureBackupInterfaceStoreAdapter } from '../adapter/impl/AzureBackupInterfaceStoreAdapter';

import {
	MockPrismaContext,
	PrismaContext,
	createMockPrismaContext,
} from '../../common/infrastructure/database/prismaContext';
import { PrismaBackupRequest } from '@prisma/client';
import { PrismaBackupRequestRepo } from '../adapter/impl/PrismaBackupRequestRepo';
import { PrismaBackupRepo } from '../../backup/adapter/impl/PrismaBackupRepo';
import { BackupProviderTypeValues } from '../../backup-job/domain/BackupProviderType';
import { AzureStoreStatusMessageHandler } from '../adapter/impl/AzureStoreStatusMessageHandler';

const TEST_EVENTS = true;

if (TEST_EVENTS) {
	describe('Events: create -> check allowed -> send to interface', () => {
		let mockPrismaCtx: MockPrismaContext;
		let prismaCtx: PrismaContext;

		beforeEach(() => {
			mockPrismaCtx = createMockPrismaContext();
			prismaCtx = mockPrismaCtx as unknown as PrismaContext;
		});

		const dbBackupRequest: PrismaBackupRequest = {
			backupRequestId: 'event-test-backup-request-id',
			backupJobId: 'event-test-backup-job-id',
			dataDate: new Date(),
			preparedDataPathName: 'db/prepared/data/path/name',
			getOnStartFlag: true,
			transportTypeCode: RequestTransportTypeValues.HTTP,
			statusTypeCode: RequestStatusTypeValues.Received,
			receivedTimestamp: new Date(),
			requesterId: 'dbRequesterId',
			backupProviderCode: null,
			checkedTimestamp: null,
			storagePathName: null,
			sentToInterfaceTimestamp: null,
			replyTimestamp: null,
			replyMessageText: null,
		};

		const backupJobProps = {
			storagePathName: 'storage path',
			backupProviderCode: 'CloudA',
			daysToKeep: 10,
			isActive: true,
			holdFlag: false,
		} as IBackupJobProps;

		const interfaceSendOk = {
			expiresOn: new Date(new Date().setDate(new Date().getDate() + 7)),
			insertedOn: new Date(),
			requestId: 'mock queue request id',
			clientRequestId: 'mock client request id',
			nextVisibleOn: new Date(),
			messageId: 'mock message id',
			popReceipt: 'mock pop receipt',
			date: new Date(),
			version: '2009-09-19',
			errorCode: '',
			_response: {
				status: 201,
				request: {
					requestId: 'mock Azure request id',
				},
				bodyAsText: '',
			},
		};

		const resultBackupJob = BackupJob.create(backupJobProps, new UniqueIdentifier());
		if (resultBackupJob.isErr()) {
			console.log('create BackupJob failed', JSON.stringify(resultBackupJob.error, null, 4));
			return;
		}

		const backupJobServiceAdapter = new MockBackupJobServiceAdapter({
			getByIdResult: {
				storagePathName: 'bjsa.storagePathName',
				backupProviderCode: 'CloudA',
				daysToKeep: 100,
				isActive: true,
				holdFlag: false,
			},
		});

		test('when a backup request is created, events run', async () => {
			// Arrange
			jest.resetAllMocks();

			// environment setup for queue adapter
			process.env.AUTH_METHOD = 'SASK';
			process.env.SASK_ACCOUNT_NAME = 'accountName';
			process.env.SASK_ACCOUNT_KEY = 'accountKey';
			process.env.AZURE_QUEUE_ACCOUNT_URI = 'uri';

			// VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
			mockPrismaCtx.prisma.prismaBackupRequest.findUnique.mockResolvedValue({ ...dbBackupRequest }); // default after responses below
			mockPrismaCtx.prisma.prismaBackupRequest.findUnique.mockResolvedValueOnce({ ...dbBackupRequest }); // first response -- for check allowed
			mockPrismaCtx.prisma.prismaBackupRequest.findUnique.mockResolvedValueOnce({
				...dbBackupRequest,
				statusTypeCode: RequestStatusTypeValues.Allowed,
				checkedTimestamp: new Date(),
			}); // second reponse -- for send to interface

			// save() just needs to succeed; result value doesn't affect outcome
			mockPrismaCtx.prisma.prismaBackupRequest.upsert.mockResolvedValue({} as unknown as PrismaBackupRequest);

			const repo = new PrismaBackupRequestRepo(prismaCtx);
			const saveSpy = jest.spyOn(repo, 'save');

			new BackupRequestCreatedSubscriber(
				new CheckRequestAllowedUseCase({
					backupRequestRepo: repo,
					backupJobServiceAdapter: backupJobServiceAdapter,
				})
			);

			// can mockResolvedValue here because we don't reuse the data structure, so no problem if it gets changed
			mockQueueSDK.QueueClient.prototype.sendMessage = jest.fn().mockResolvedValue(interfaceSendOk);
			const qAdapter = new AzureBackupInterfaceStoreAdapter('test-queue');
			const sendSpy = jest.spyOn(qAdapter, 'send');

			new BackupRequestAllowedSubscriber(
				new SendRequestToInterfaceUseCase({
					backupRequestRepo: repo,
					interfaceStoreAdapter: qAdapter,
				})
			);

			const useCase = new CreateBackupRequestUseCase(repo);
			const dto = {
				apiVersion: '2022-01-01',
				backupJobId: 'b753d695-c9e1-4fa1-99f0-9fc025fca24c',
				dataDate: '2022-01-31',
				backupDataLocation: '/path/to/data',
				transportType: 'HTTP',
				getOnStartFlag: true,
			};

			// Act
			const result = await useCase.execute(dto);
			// give events time to run before continuing
			await (() => new Promise((resolve) => setTimeout(resolve, 1 * 1000)))();

			// Assert
			expect(result.isOk()).toBe(true);
			expect(saveSpy).toHaveBeenCalledTimes(3); // create, check, send
			expect(sendSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe('Events: reply -> runs use case', () => {
		let mockPrismaCtx: MockPrismaContext;
		let prismaCtx: PrismaContext;

		beforeEach(() => {
			mockPrismaCtx = createMockPrismaContext();
			prismaCtx = mockPrismaCtx as unknown as PrismaContext;
		});

		const now = new Date();
		const offset = 40 * 60 * 1000;
		const statusMessage = {
			backupRequestId: 'reply-requestId',
			storagePathName: 'reply-storagePathName',
			resultTypeCode: 'Succeeded',
			backupByteCount: 123456,
			copyStartTimestamp: new Date(now.valueOf() - offset).toISOString(),
			copyEndTimestamp: new Date(now.valueOf() - offset * 0.5).toISOString(),
			verifyStartTimestamp: new Date(now.valueOf() - offset * 0.5 - 1000).toISOString(),
			verifyEndTimestamp: new Date(now.valueOf() - 1000).toISOString(),
			verifiedHash: 'ABC123-hash',
			messageText: 'reply-message',
		};

		const queueStatusMessage = {
			messageText: JSON.stringify(statusMessage),
			messageId: 'qsm-messageId',
			popReceipt: 'qsm-popReceipt',
			dequeueCount: 0,
			expiresOn: new Date(new Date().setDate(new Date().getDate() + 7)),
			insertedOn: new Date(),
			requestId: 'qsm-requestId',
			clientRequestId: 'qsm-clientRequestId',
		};

		const mockRcvOk = {
			receivedMessageItems: [queueStatusMessage],
			requestId: 'mro-requestId',
			clientRequestId: 'mro-clientRequestId',
			date: new Date(),
			version: '2009-09-19',
			errorCode: '',
			_response: {
				status: 201,
				request: {
					requestId: 'mro Azure request id',
				},
				bodyAsText: '',
			},
		};

		const mockDelOk = {
			clientRequestId: 'del-client-request-id',
			date: new Date(),
			errorCode: '',
			requestId: 'del-request-id',
			version: '2021-01-01',
			_response: {
				status: 204,
				request: {
					requestId: 'del-request-id',
				},
			},
		};

		const dbBackupRequest: PrismaBackupRequest = {
			backupRequestId: 'event-test-backup-request-id',
			backupJobId: 'event-test-backup-job-id',
			dataDate: new Date(),
			preparedDataPathName: 'db/prepared/data/path/name',
			getOnStartFlag: true,
			transportTypeCode: RequestTransportTypeValues.HTTP,
			statusTypeCode: RequestStatusTypeValues.Sent,
			receivedTimestamp: new Date(now.valueOf() - offset * 2),
			requesterId: 'dbRequesterId',
			backupProviderCode: null,
			checkedTimestamp: new Date(now.valueOf() - offset * 1.9),
			storagePathName: null,
			sentToInterfaceTimestamp: new Date(now.valueOf() - offset * 1.8),
			replyTimestamp: null,
			replyMessageText: null,
		};

		const backupJobDTO: IBackupJobProps = {
			storagePathName: 'storage/path',
			backupProviderCode: BackupProviderTypeValues.CloudA,
			daysToKeep: 100,
			isActive: true,
			holdFlag: false,
		};

		test('when a store status reply is received in Succeeds status, backup created, request updated, message deleted', async () => {
			// Arrange

			//** Receiver requirements **//

			// env for AzureQueue
			process.env.AUTH_METHOD = 'SASK';
			process.env.SASK_ACCOUNT_NAME = 'accountName';
			process.env.SASK_ACCOUNT_KEY = 'accountKey';
			process.env.AZURE_QUEUE_ACCOUNT_URI = 'test-uri'; // not checked for SASK because SASK is local only

			// mock SDK receive
			mockQueueSDK.QueueClient.prototype.receiveMessages = jest.fn().mockResolvedValueOnce({ ...mockRcvOk });
			const receiveSpy = jest.spyOn(mockQueueSDK.QueueClient.prototype, 'receiveMessages');

			// mock SDK delete
			mockQueueSDK.QueueClient.prototype.deleteMessage = jest.fn().mockResolvedValueOnce(mockDelOk);
			const deleteSpy = jest.spyOn(mockQueueSDK.QueueClient.prototype, 'deleteMessage');

			//** Use case requirements **//

			// Mock database results
			mockPrismaCtx.prisma.prismaBackupRequest.findUnique.mockResolvedValue({ ...dbBackupRequest });
			mockPrismaCtx.prisma.prismaBackup.findFirst.mockResolvedValue(null); // no backup exists

			const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);
			const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

			const backupRepo = new PrismaBackupRepo(prismaCtx);
			const backupSaveSpy = jest.spyOn(backupRepo, 'save');

			// Backup job service
			const backupJobServiceAdapter = new MockBackupJobServiceAdapter({ getByIdResult: { ...backupJobDTO } });

			// set up adapter, use case, and subscriber
			const abisa = new AzureBackupInterfaceStoreAdapter('test-queue', false);
			const rcvUseCase = new ReceiveStoreStatusReplyUseCase({
				backupRequestRepo,
				backupRepo,
				backupJobServiceAdapter,
			});
			new StoreStatusReceivedSubscriber(rcvUseCase, abisa);

			//** Queue poller simulation requirement **//
			const msgHandler = new AzureStoreStatusMessageHandler();

			// Act
			// The queue poller will loop and call abisa.receive()
			const pollResult = await abisa.receive(1);
			if (pollResult.isOk()) {
				pollResult.value.messages.forEach((msg) => {
					msgHandler.processMessage(msg as ReceivedMessageItem);
				});
			} else {
				console.log('testEvents, abisa pollResult', pollResult.error);
			}
			await delay(1000);

			expect(receiveSpy).toBeCalledTimes(1);
			expect(deleteSpy).toBeCalledTimes(1);
			expect(backupRequestSaveSpy).toBeCalledTimes(1);
			expect(backupSaveSpy).toBeCalledTimes(1);
		});
	});
} else {
	test('skipped event tests', () => {
		console.log(
			' *'.repeat(35),
			'\n',
			' *'.repeat(35),
			'\n',
			'***** skipped event tests *****',
			'\n',
			' *'.repeat(35),
			'\n',
			' *'.repeat(35),
			'\n'
		);
		expect(true).toBe(true);
	});
}
