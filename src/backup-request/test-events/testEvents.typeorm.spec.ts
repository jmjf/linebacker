// mock the Azure SDK
jest.mock('@azure/storage-queue');
import * as mockQueueSDK from '@azure/storage-queue';

import { ReceivedMessageItem } from '@azure/storage-queue';

import { CircuitBreakerWithRetry } from '../../infrastructure/resilience/CircuitBreakerWithRetry';
import { ApplicationResilienceReady } from '../../infrastructure/resilience/ApplicationResilienceReady.event';
import {
	MockTypeormContext,
	TypeormContext,
	createMockTypeormContext,
} from '../../infrastructure/typeorm/typeormContext';
import { TypeormBackupRequest } from '../../infrastructure/typeorm/entity/TypeormBackupRequest.entity';
import { TypeormBackup } from '../../infrastructure/typeorm/entity/TypeormBackup.entity';
import { buildCircuitBreakers } from '../../infrastructure/typeorm/buildCircuitBreakers.typeorm';

import { ok } from '../../common/core/Result';
import { eventBus } from '../../common/infrastructure/event-bus/eventBus';
import { delay } from '../../common/utils/utils';
import { UniqueIdentifier } from '../../common/domain/UniqueIdentifier';

import { RequestTransportTypeValues } from '../domain/RequestTransportType';
import { BackupRequestStatusTypeValues } from '../domain/BackupRequestStatusType';

import { BackupJob, IBackupJobProps } from '../../backup-job/domain/BackupJob';
import { MockBackupJobServiceAdapter } from '../../backup-job/adapter/impl/MockBackupJobServiceAdapter';

import { BackupProviderTypeValues } from '../../backup-job/domain/BackupProviderType';

import { SendRequestToInterfaceUseCase } from '../use-cases/send-request-to-interface/SendRequestToInterfaceUseCase';
import { BackupRequestAllowedSubscriber } from '../use-cases/send-request-to-interface/BackupRequestAllowedSubscriber';

import { BackupRequestCreatedSubscriber } from '../use-cases/check-request-allowed/BackupRequestCreatedSubscriber';
import { CheckRequestAllowedUseCase } from '../use-cases/check-request-allowed/CheckRequestAllowedUseCase';
import { CreateBackupRequestUseCase } from '../use-cases/create-backup-request/CreateBackupRequestUseCase';

import { StoreStatusReceivedSubscriber } from '../use-cases/receive-store-status-reply/StoreStatusReceivedSubscriber';
import { ReceiveStoreStatusReplyUseCase } from '../use-cases/receive-store-status-reply/ReceiveStoreStatusReplyUseCase';

import { AzureStoreStatusMessageHandler } from '../adapter/impl/AzureStoreStatusMessageHandler';
import { AzureBackupInterfaceStoreAdapter } from '../adapter/impl/AzureBackupInterfaceStoreAdapter';

import { ApplicationResilienceReadySubscriber } from '../use-cases/restart-stalled-requests/ApplicationResilienceReadySubscriber';
import { RestartStalledRequestsUseCase } from '../use-cases/restart-stalled-requests/RestartStalledRequestsUseCase';

import { TypeormBackupRequestRepo } from '../adapter/impl/TypeormBackupRequestRepo';
import { TypeormBackupRepo } from '../../backup/adapter/impl/TypeormBackupRepo';

import { getLenientCircuitBreaker } from '../../test-helpers/circuitBreakerHelpers';
import { setAppStateForAzureQueue, useSask } from '../../test-helpers/AzureQueueTestHelpers';

const TEST_EVENTS = true;

if (TEST_EVENTS) {
	describe('Events: create -> check allowed -> send to interface', () => {
		let mockTypeormCtx: MockTypeormContext;
		let typeormCtx: TypeormContext;

		beforeEach(() => {
			mockTypeormCtx = createMockTypeormContext();
			typeormCtx = mockTypeormCtx as unknown as TypeormContext;

			setAppStateForAzureQueue();
			useSask();
		});

		const dbBackupRequest: TypeormBackupRequest = {
			backupRequestId: 'event-test-backup-request-id',
			backupJobId: 'event-test-backup-job-id',
			dataDate: new Date(),
			preparedDataPathName: 'db/prepared/data/path/name',
			getOnStartFlag: true,
			transportTypeCode: RequestTransportTypeValues.HTTP,
			statusTypeCode: BackupRequestStatusTypeValues.Received,
			acceptedTimestamp: new Date(),
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

			// VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
			mockTypeormCtx.manager.findOne.mockResolvedValue({ ...dbBackupRequest }); // default after responses below
			mockTypeormCtx.manager.findOne.mockResolvedValueOnce({ ...dbBackupRequest }); // first response -- for check allowed
			mockTypeormCtx.manager.findOne.mockResolvedValueOnce({
				...dbBackupRequest,
				statusTypeCode: BackupRequestStatusTypeValues.Allowed,
				checkedTimestamp: new Date(),
			}); // second reponse -- for send to interface

			// save() just needs to succeed; result value doesn't affect outcome
			mockTypeormCtx.manager.save.mockResolvedValue({} as TypeormBackupRequest);

			// can use the default circuit breakers because this should be a non-failure test
			const abortController = new AbortController();
			const circuitBreakers = buildCircuitBreakers(abortController.signal);

			const repo = new TypeormBackupRequestRepo(typeormCtx, circuitBreakers.dbCircuitBreaker);
			const saveSpy = jest.spyOn(repo, 'save');

			new BackupRequestCreatedSubscriber(
				new CheckRequestAllowedUseCase({
					backupRequestRepo: repo,
					backupJobServiceAdapter: backupJobServiceAdapter,
				})
			);

			// can mockResolvedValue here because we don't reuse the data structure, so no problem if it gets changed
			mockQueueSDK.QueueClient.prototype.sendMessage = jest.fn().mockResolvedValue(interfaceSendOk);
			const qAdapter = new AzureBackupInterfaceStoreAdapter('test-queue', circuitBreakers.azureQueueCircuitBreaker);
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

			abortController.abort();
			await delay(10);
		});
	});

	describe('Events: reply -> runs use case', () => {
		let mockTypeormCtx: MockTypeormContext;
		let typeormCtx: TypeormContext;

		beforeEach(() => {
			mockTypeormCtx = createMockTypeormContext();
			typeormCtx = mockTypeormCtx as unknown as TypeormContext;

			setAppStateForAzureQueue();
			useSask();
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

		const dbBackupRequest: TypeormBackupRequest = {
			backupRequestId: 'event-test-backup-request-id',
			backupJobId: 'event-test-backup-job-id',
			dataDate: new Date(),
			preparedDataPathName: 'db/prepared/data/path/name',
			getOnStartFlag: true,
			transportTypeCode: RequestTransportTypeValues.HTTP,
			statusTypeCode: BackupRequestStatusTypeValues.Sent,
			acceptedTimestamp: new Date(),
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

			// mock SDK receive
			mockQueueSDK.QueueClient.prototype.receiveMessages = jest.fn().mockResolvedValueOnce({ ...mockRcvOk });
			const receiveSpy = jest.spyOn(mockQueueSDK.QueueClient.prototype, 'receiveMessages');

			// mock SDK delete
			mockQueueSDK.QueueClient.prototype.deleteMessage = jest.fn().mockResolvedValueOnce(mockDelOk);
			const deleteSpy = jest.spyOn(mockQueueSDK.QueueClient.prototype, 'deleteMessage');

			//** Use case requirements **//

			// I need to return different results from TypeORM for different calls. Prisma
			// puts the methods on the entity type, but TypeORM puts them on the manager.
			mockTypeormCtx.manager.findOne.mockResolvedValue(null); // default return after mock once used up
			mockTypeormCtx.manager.findOne.mockResolvedValueOnce(dbBackupRequest); // first return (backup request read first)
			// Backup read returns no result for this test case, so no need for another mock

			mockTypeormCtx.manager.save.mockResolvedValue(null); // default return after mock once used up
			mockTypeormCtx.manager.save.mockResolvedValueOnce({} as TypeormBackup); // first return (backup saved first)
			// BackupRequest save() will fail
			mockTypeormCtx.manager.save.mockResolvedValueOnce({} as TypeormBackupRequest); // second return (backup request saved second)

			// can use the default circuit breakers because this should be a non-failure test
			const abortController = new AbortController();
			const circuitBreakers = buildCircuitBreakers(abortController.signal);

			// Mock database results
			const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreakers.dbCircuitBreaker);
			const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

			const backupRepo = new TypeormBackupRepo(typeormCtx, circuitBreakers.dbCircuitBreaker);
			const backupSaveSpy = jest.spyOn(backupRepo, 'save');

			// Backup job service
			const backupJobServiceAdapter = new MockBackupJobServiceAdapter({ getByIdResult: { ...backupJobDTO } });

			// set up adapter, use case, and subscriber
			const abisa = new AzureBackupInterfaceStoreAdapter(
				'test-queue',
				circuitBreakers.azureQueueCircuitBreaker,
				false
			);
			const rcvUseCase = new ReceiveStoreStatusReplyUseCase({
				backupRequestRepo,
				backupRepo,
				backupJobServiceAdapter,
			});
			new StoreStatusReceivedSubscriber(rcvUseCase, abisa);

			//** Queue poller simulation requirement **//
			const msgHandler = new AzureStoreStatusMessageHandler(abisa);

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

			abortController.abort();
			await delay(10);
		});
	});

	describe('Events: restart recovery -> runs use case', () => {
		let mockTypeormCtx: MockTypeormContext;
		let typeormCtx: TypeormContext;
		let circuitBreaker: CircuitBreakerWithRetry;
		let abortController: AbortController;

		beforeEach(() => {
			mockTypeormCtx = createMockTypeormContext();
			typeormCtx = mockTypeormCtx as unknown as TypeormContext;

			eventBus.clearHandlers();

			const isAlive = () => {
				return Promise.resolve(ok(true));
			};
			abortController = new AbortController();
			circuitBreaker = getLenientCircuitBreaker('TypeORM', abortController.signal);
		});

		const dbAllowedResults: TypeormBackupRequest[] = [
			{
				backupRequestId: 'dbBackupRequestId-ALW1',
				backupJobId: 'Allowed1',
				dataDate: new Date(),
				preparedDataPathName: 'path',
				getOnStartFlag: true,
				transportTypeCode: RequestTransportTypeValues.HTTP,
				statusTypeCode: BackupRequestStatusTypeValues.Allowed,
				acceptedTimestamp: new Date(),
				receivedTimestamp: new Date(),
				requesterId: 'dbRequesterId',
				backupProviderCode: 'CloudA',
				checkedTimestamp: new Date(),
				storagePathName: 'dbStoragePathName',
				sentToInterfaceTimestamp: null,
				replyTimestamp: null,
				replyMessageText: null,
			},
			{
				backupRequestId: 'dbBackupRequestId-ALW2',
				backupJobId: 'Allowed2',
				dataDate: new Date(),
				preparedDataPathName: 'path',
				getOnStartFlag: true,
				transportTypeCode: RequestTransportTypeValues.HTTP,
				statusTypeCode: BackupRequestStatusTypeValues.Allowed,
				acceptedTimestamp: new Date(),
				receivedTimestamp: new Date(),
				requesterId: 'dbRequesterId',
				backupProviderCode: 'CloudA',
				checkedTimestamp: new Date(),
				storagePathName: 'dbStoragePathName',
				sentToInterfaceTimestamp: null,
				replyTimestamp: null,
				replyMessageText: null,
			},
		];

		const dbReceivedResults: TypeormBackupRequest[] = [
			{
				backupRequestId: 'dbBackupRequestId-RCV1',
				backupJobId: 'Received1',
				dataDate: new Date(),
				preparedDataPathName: 'path',
				getOnStartFlag: true,
				transportTypeCode: RequestTransportTypeValues.HTTP,
				statusTypeCode: BackupRequestStatusTypeValues.Received,
				acceptedTimestamp: new Date(),
				receivedTimestamp: new Date(),
				requesterId: 'dbRequesterId',
				backupProviderCode: 'CloudA',
				checkedTimestamp: null,
				storagePathName: 'dbStoragePathName',
				sentToInterfaceTimestamp: null,
				replyTimestamp: null,
				replyMessageText: null,
			},
			{
				backupRequestId: 'dbBackupRequestId-RCV2',
				backupJobId: 'Received2',
				dataDate: new Date(),
				preparedDataPathName: 'path',
				getOnStartFlag: true,
				transportTypeCode: RequestTransportTypeValues.HTTP,
				statusTypeCode: BackupRequestStatusTypeValues.Received,
				acceptedTimestamp: new Date(),
				receivedTimestamp: new Date(),
				requesterId: 'dbRequesterId',
				backupProviderCode: 'CloudA',
				checkedTimestamp: null,
				storagePathName: 'dbStoragePathName',
				sentToInterfaceTimestamp: null,
				replyTimestamp: null,
				replyMessageText: null,
			},
		];

		test('when the ApplicationResilienceReady event publishes, the restart use case runs', async () => {
			// Arrange
			mockTypeormCtx.manager.find.mockResolvedValueOnce(dbAllowedResults);
			mockTypeormCtx.manager.find.mockResolvedValueOnce(dbReceivedResults);

			const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreaker);
			const brGetBeforeSpy = jest.spyOn(backupRequestRepo, 'getByStatusBeforeTimestamp');

			const useCase = new RestartStalledRequestsUseCase(backupRequestRepo, abortController.signal);

			const subscriber = new ApplicationResilienceReadySubscriber(useCase);
			const subscriberSpy = jest.spyOn(subscriber, 'onApplicationResilienceReady');

			const event = new ApplicationResilienceReady(new Date());

			// Act
			eventBus.publishEvent(event);

			await delay(1000);

			// Assert
			expect(brGetBeforeSpy).toHaveBeenCalledTimes(2);
			// haven't set up subscribers for the events that are queued so won't run
			// logging should show 2 events for allowed and received

			abortController.abort();
			await delay(10);
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
