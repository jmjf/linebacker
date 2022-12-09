// mock the Azure SDK -- this test suite uses an adapter that connects to an Azure Storage queue
jest.mock('@azure/storage-queue');
import * as mockQueueSDK from '@azure/storage-queue';

import { CircuitBreakerWithRetry } from '../../../infrastructure/resilience/CircuitBreakerWithRetry';
import {
	MockTypeormContext,
	TypeormContext,
	createMockTypeormContext,
} from '../../../infrastructure/typeorm/typeormContext';
import { TypeormBackupRequestRepo } from '../../adapter/impl/TypeormBackupRequestRepo';
import { TypeormBackupRequest } from '../../../infrastructure/typeorm/entity/TypeormBackupRequest.entity';

import { ok } from '../../../common/core/Result';
import { delay } from '../../../common/utils/utils';

import { RequestTransportTypeValues } from '../../domain/RequestTransportType';
import { BackupRequestStatusTypeValues } from '../../domain/BackupRequestStatusType';

import { AzureBackupInterfaceStoreAdapter } from '../../adapter/impl/AzureBackupInterfaceStoreAdapter';

import { SendRequestToInterfaceUseCase } from './SendRequestToInterfaceUseCase';
import { SendRequestToInterfaceDTO } from './SendRequestToInterfaceDTO';

import { getLenientCircuitBreaker } from '../../../test-helpers/circuitBreakerHelpers';
import { setAppStateForAzureQueue, useSask } from '../../../test-helpers/AzureQueueTestHelpers';

describe('SendRequestToInterfaceUseCase - typeorm', () => {
	let mockTypeormCtx: MockTypeormContext;
	let typeormCtx: TypeormContext;
	let dbCircuitBreaker: CircuitBreakerWithRetry;
	let azureQueueCircuitBreaker: CircuitBreakerWithRetry;
	let abortController: AbortController;

	beforeEach(() => {
		mockTypeormCtx = createMockTypeormContext();
		typeormCtx = mockTypeormCtx as unknown as TypeormContext;

		const isAlive = () => {
			return Promise.resolve(ok(true));
		};
		abortController = new AbortController();
		dbCircuitBreaker = getLenientCircuitBreaker('TypeORM', abortController.signal);
		azureQueueCircuitBreaker = getLenientCircuitBreaker('AzureQueue', abortController.signal);

		setAppStateForAzureQueue();
		useSask();
	});

	afterEach(() => {
		abortController.abort();
		delay(100);
	});

	const baseDto = {
		backupRequestId: 'sendToInterfaceRequestId',
	} as SendRequestToInterfaceDTO;

	const dbBackupRequest: TypeormBackupRequest = {
		backupRequestId: 'dbBackupRequestId',
		backupJobId: 'dbBackupJobId',
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
	};

	const mockSendOk = {
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

	const mockSendError = {
		requestId: 'mock queue request id',
		clientRequestId: 'mock client request id',
		date: new Date(),
		version: '2009-09-19',
		errorCode: '',
		_response: {
			status: 401,
			request: {
				requestId: 'mock Azure request id',
			},
		},
	};

	test.each([
		{ status: BackupRequestStatusTypeValues.Sent, timestampName: 'sentToInterfaceTimestamp' },
		{ status: BackupRequestStatusTypeValues.Failed, timestampName: 'replyTimestamp' },
		{ status: BackupRequestStatusTypeValues.Succeeded, timestampName: 'replyTimestamp' },
	])('when request is $status, it returns err (BackupRequestStatusError)', async ({ status, timestampName }) => {
		// Arrange
		const resultBackupRequest = {
			...dbBackupRequest,
			backupJobId: 'request is sent job id',
			statusTypeCode: status,
		};
		(resultBackupRequest as Record<string, unknown>)[timestampName] = new Date();

		// VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
		mockTypeormCtx.manager.findOne.mockResolvedValue(resultBackupRequest as TypeormBackupRequest);

		const brRepo = new TypeormBackupRequestRepo(typeormCtx, dbCircuitBreaker);
		const saveSpy = jest.spyOn(brRepo, 'save');

		// should not call adapter, so no need to mock SDK
		const qAdapter = new AzureBackupInterfaceStoreAdapter('test-queue', azureQueueCircuitBreaker);
		const sendSpy = jest.spyOn(qAdapter, 'send');

		const useCase = new SendRequestToInterfaceUseCase({
			backupRequestRepo: brRepo,
			interfaceStoreAdapter: qAdapter,
		});
		const dto = { ...baseDto };

		// Act
		const result = await useCase.execute(dto);

		// Assert
		expect(result.isErr()).toBe(true);
		expect(saveSpy).toBeCalledTimes(0);
		expect(sendSpy).toBeCalledTimes(0);
		if (result.isErr()) {
			// type guard
			expect(result.error.name).toBe('BackupRequestStatusError');
			expect((result.error.errorData as any).statusTypeCode).toBe(status);
		}
	});

	test('when backup request does not exist, it returns failure', async () => {
		// Arrange

		// findUnique() returns null if not found
		// VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
		mockTypeormCtx.manager.findOne.mockResolvedValue(null as unknown as TypeormBackupRequest);

		const brRepo = new TypeormBackupRequestRepo(typeormCtx, dbCircuitBreaker);
		const saveSpy = jest.spyOn(brRepo, 'save');

		// should not call adapter, so no need to mock SDK
		const qAdapter = new AzureBackupInterfaceStoreAdapter('test-queue', azureQueueCircuitBreaker);
		const sendSpy = jest.spyOn(qAdapter, 'send');

		const useCase = new SendRequestToInterfaceUseCase({ backupRequestRepo: brRepo, interfaceStoreAdapter: qAdapter });
		const dto = { ...baseDto };

		// Act
		const result = await useCase.execute(dto);

		// Assert
		expect(result.isErr()).toBe(true);
		expect(saveSpy).toBeCalledTimes(0);
		expect(sendSpy).toBeCalledTimes(0);
		if (result.isErr()) {
			// type guard
			expect(result.error.name).toBe('NotFoundError');
			expect((result.error.errorData as any).backupRequestId).toMatch(dto.backupRequestId);
		}
	});

	test('when request is NotAllowed, it returns failure', async () => {
		// Arrange
		const resultBackupRequest: TypeormBackupRequest = {
			...dbBackupRequest,
			backupJobId: 'request NotAllowed job id',
			statusTypeCode: 'NotAllowed',
			checkedTimestamp: new Date(),
		};

		// VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
		mockTypeormCtx.manager.findOne.mockResolvedValue(resultBackupRequest);

		const brRepo = new TypeormBackupRequestRepo(typeormCtx, dbCircuitBreaker);
		const saveSpy = jest.spyOn(brRepo, 'save');

		// should not call adapter, so no need to mock SDK
		const qAdapter = new AzureBackupInterfaceStoreAdapter('test-queue', azureQueueCircuitBreaker);
		const sendSpy = jest.spyOn(qAdapter, 'send');

		const useCase = new SendRequestToInterfaceUseCase({ backupRequestRepo: brRepo, interfaceStoreAdapter: qAdapter });
		const dto = { ...baseDto };

		// Act
		const result = await useCase.execute(dto);

		// Assert
		expect(result.isErr()).toBe(true);
		expect(saveSpy).toBeCalledTimes(0);
		expect(sendSpy).toBeCalledTimes(0);
		if (result.isErr()) {
			// type guard
			expect(result.error.name).toBe('BackupRequestStatusError');
			expect(result.error.message).toMatch('in Allowed');
		}
	});

	test('when request is allowed and sendMessage fails, it returns failure', async () => {
		// Arrange
		const resultBackupRequest: TypeormBackupRequest = {
			...dbBackupRequest,
			backupJobId: 'send fails job id',
		};

		// VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
		mockTypeormCtx.manager.findOne.mockResolvedValue(resultBackupRequest);

		const brRepo = new TypeormBackupRequestRepo(typeormCtx, dbCircuitBreaker);
		const saveSpy = jest.spyOn(brRepo, 'save');

		mockQueueSDK.QueueClient.prototype.sendMessage = jest.fn().mockResolvedValueOnce(mockSendError);
		const qAdapter = new AzureBackupInterfaceStoreAdapter('test-queue', azureQueueCircuitBreaker);
		const sendSpy = jest.spyOn(qAdapter, 'send');

		const useCase = new SendRequestToInterfaceUseCase({ backupRequestRepo: brRepo, interfaceStoreAdapter: qAdapter });
		const dto = { ...baseDto };

		// Act
		const result = await useCase.execute(dto);

		// Assert
		expect(result.isErr()).toBe(true);
		expect(saveSpy).toBeCalledTimes(0);
		expect(sendSpy).toBeCalledTimes(1);
		if (result.isErr()) {
			// type guard
			expect(result.error.name).toBe('SendToInterfaceError');
		}
	});

	test('when request is Allowed and sendMessage succeeds, it returns a BackupRequest in Sent status', async () => {
		// Arrange
		const startTimestamp = new Date();

		// VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
		mockTypeormCtx.manager.findOne.mockResolvedValue(dbBackupRequest);
		const brRepo = new TypeormBackupRequestRepo(typeormCtx, dbCircuitBreaker);
		const saveSpy = jest.spyOn(brRepo, 'save');

		mockQueueSDK.QueueClient.prototype.sendMessage = jest.fn().mockImplementation((message: string) => {
			// Deep copy object
			const mockResult = JSON.parse(JSON.stringify(mockSendOk));
			// JSON stringify converts dates to strings, so make them dates again
			mockResult.expiresOn = new Date(mockResult.expiresOn);
			mockResult.insertedOn = new Date(mockResult.insertedOn);
			mockResult.nextVisibleOn = new Date(mockResult.nextVisibleOn);
			mockResult.date = new Date(mockResult.date);
			mockResult._response.bodyAsText = message;
			return mockResult;
		});
		const qAdapter = new AzureBackupInterfaceStoreAdapter('test-queue', azureQueueCircuitBreaker);
		const sendSpy = jest.spyOn(qAdapter, 'send');

		const useCase = new SendRequestToInterfaceUseCase({ backupRequestRepo: brRepo, interfaceStoreAdapter: qAdapter });
		const dto = { ...baseDto };

		// Act
		const result = await useCase.execute(dto);

		// Assert
		expect(result.isOk()).toBe(true);
		expect(saveSpy).toBeCalledTimes(1);
		expect(sendSpy).toBeCalledTimes(1);
		if (result.isOk()) {
			// type guard makes the rest easier
			expect(result.value.statusTypeCode).toBe(BackupRequestStatusTypeValues.Sent);
			expect(result.value.sentToInterfaceTimestamp.valueOf()).toBeGreaterThanOrEqual(startTimestamp.valueOf());
			// The use case doesn't check Base64 because it's tested in the adapter and the use case doesn't return bodyAsText to check
		}
	});

	// TODO: Add a test for adapter error
});
