// mock the Azure SDK
jest.mock('@azure/storage-queue');
import * as mockQueueSDK from '@azure/storage-queue';

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

import { AzureBackupInterfaceStoreAdapter } from '../adapter/impl/AzureBackupInterfaceStoreAdapter';

import {
	MockPrismaContext,
	PrismaContext,
	createMockPrismaContext,
} from '../../common/infrastructure/database/prismaContext';
import { BackupRequest } from '@prisma/client';
import { PrismaBackupRequestRepo } from '../adapter/impl/PrismaBackupRequestRepo';

const TEST_EVENTS = true;

if (TEST_EVENTS) {
	describe('Events: create -> check allowed -> send to interface', () => {
		let mockPrismaCtx: MockPrismaContext;
		let prismaCtx: PrismaContext;

		beforeEach(() => {
			mockPrismaCtx = createMockPrismaContext();
			prismaCtx = mockPrismaCtx as unknown as PrismaContext;
		});

		const dbBackupRequest: BackupRequest = {
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
			messageId: 'mock message id',
			nextVisibleOn: new Date(),
			popReceipt: 'mock pop receipt',
			requestId: 'mock queue request id',
			clientRequestId: 'mock client request id',
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
			mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValue({ ...dbBackupRequest }); // default after responses below
			mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValueOnce({ ...dbBackupRequest }); // first response -- for check allowed
			mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValueOnce({
				...dbBackupRequest,
				statusTypeCode: RequestStatusTypeValues.Allowed,
				checkedTimestamp: new Date(),
			}); // second reponse -- for send to interface

			// save() just needs to succeed; result value doesn't affect outcome
			mockPrismaCtx.prisma.backupRequest.upsert.mockResolvedValue({} as unknown as BackupRequest);

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
