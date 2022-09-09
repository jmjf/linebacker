// mock the Azure SDK
jest.mock('@azure/storage-queue');
import * as mockQueueSDK from '@azure/storage-queue';

import { RequestTransportTypeValues } from '../../domain/RequestTransportType';
import { RequestStatusTypeValues } from '../../domain/RequestStatusType';

import { AzureBackupInterfaceStoreAdapter } from '../../adapter/impl/AzureBackupInterfaceStoreAdapter';

import { SendRequestToInterfaceUseCase } from './SendRequestToInterfaceUseCase';
import { SendRequestToInterfaceDTO } from './SendRequestToInterfaceDTO';

import { CircuitBreakerWithRetry } from '../../../infrastructure/CircuitBreakerWithRetry';
import { ok } from '../../../common/core/Result';

import { MockPrismaContext, PrismaContext, createMockPrismaContext } from '../../../infrastructure/prismaContext';
import { PrismaBackupRequest } from '@prisma/client';
import { PrismaBackupRequestRepo } from '../../adapter/impl/PrismaBackupRequestRepo';
import { delay, Dictionary } from '../../../utils/utils';

describe('SendRequestToInterfaceUseCase - Prisma', () => {
	let mockPrismaCtx: MockPrismaContext;
	let prismaCtx: PrismaContext;
	let dbCircuitBreaker: CircuitBreakerWithRetry;
	let abortController: AbortController;

	beforeEach(() => {
		mockPrismaCtx = createMockPrismaContext();
		prismaCtx = mockPrismaCtx as unknown as PrismaContext;

		const isAlive = () => {
			return Promise.resolve(ok(true));
		};

		abortController = new AbortController();
		dbCircuitBreaker = new CircuitBreakerWithRetry({
			isAlive,
			abortSignal: abortController.signal,
			serviceName: 'TypeORM',
			successToCloseCount: 1,
			failureToOpenCount: 100,
			halfOpenRetryDelayMs: 5,
			closedRetryDelayMs: 5,
			openAliveCheckDelayMs: 5,
		});
	});

	afterEach(() => {
		abortController.abort();
		delay(250);
	});

	const baseDto = {
		backupRequestId: 'sendToInterfaceRequestId',
	} as SendRequestToInterfaceDTO;

	const dbBackupRequest: PrismaBackupRequest = {
		backupRequestId: 'dbBackupRequestId',
		backupJobId: 'dbBackupJobId',
		dataDate: new Date(),
		preparedDataPathName: 'path',
		getOnStartFlag: true,
		transportTypeCode: RequestTransportTypeValues.HTTP,
		statusTypeCode: RequestStatusTypeValues.Allowed,
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

	// mock environment -- use SASK because it's easier; other parts of queue framework covered in AzureQueue.spec.ts
	process.env.AUTH_METHOD = 'SASK';
	process.env.SASK_ACCOUNT_NAME = 'accountName';
	process.env.SASK_ACCOUNT_KEY = 'accountKey';
	process.env.AZURE_QUEUE_ACCOUNT_URI = 'uri';

	test.each([
		{ status: RequestStatusTypeValues.Sent, timestampName: 'sentToInterfaceTimestamp' },
		{ status: RequestStatusTypeValues.Failed, timestampName: 'replyTimestamp' },
		{ status: RequestStatusTypeValues.Succeeded, timestampName: 'replyTimestamp' },
	])('when request is $status, it returns err (BackupRequestStatusError)', async ({ status, timestampName }) => {
		// Arrange
		const resultBackupRequest: Dictionary = {
			...dbBackupRequest,
			backupJobId: 'request is sent job id',
			statusTypeCode: status,
		};
		resultBackupRequest[timestampName] = new Date();
		const expectedTimestamp = new Date(resultBackupRequest[timestampName]); // ensure we have a separate instance

		// VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
		mockPrismaCtx.prisma.prismaBackupRequest.findUnique.mockResolvedValue(resultBackupRequest as PrismaBackupRequest);

		const brRepo = new PrismaBackupRequestRepo(prismaCtx, dbCircuitBreaker);
		const saveSpy = jest.spyOn(brRepo, 'save');

		// should not call adapter, so no need to mock SDK
		const qAdapter = new AzureBackupInterfaceStoreAdapter('test-queue');
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
		mockPrismaCtx.prisma.prismaBackupRequest.findUnique.mockResolvedValue(null as unknown as PrismaBackupRequest);

		const brRepo = new PrismaBackupRequestRepo(prismaCtx, dbCircuitBreaker);
		const saveSpy = jest.spyOn(brRepo, 'save');

		// should not call adapter, so no need to mock SDK
		const qAdapter = new AzureBackupInterfaceStoreAdapter('test-queue');
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
		const resultBackupRequest: PrismaBackupRequest = {
			...dbBackupRequest,
			backupJobId: 'request NotAllowed job id',
			statusTypeCode: 'NotAllowed',
			checkedTimestamp: new Date(),
		};

		// VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
		mockPrismaCtx.prisma.prismaBackupRequest.findUnique.mockResolvedValue(resultBackupRequest);

		const brRepo = new PrismaBackupRequestRepo(prismaCtx, dbCircuitBreaker);
		const saveSpy = jest.spyOn(brRepo, 'save');

		// should not call adapter, so no need to mock SDK
		const qAdapter = new AzureBackupInterfaceStoreAdapter('test-queue');
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
		const resultBackupRequest: PrismaBackupRequest = {
			...dbBackupRequest,
			backupJobId: 'send fails job id',
		};

		// VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
		mockPrismaCtx.prisma.prismaBackupRequest.findUnique.mockResolvedValue(resultBackupRequest);

		const brRepo = new PrismaBackupRequestRepo(prismaCtx, dbCircuitBreaker);
		const saveSpy = jest.spyOn(brRepo, 'save');

		mockQueueSDK.QueueClient.prototype.sendMessage = jest.fn().mockResolvedValueOnce(mockSendError);
		const qAdapter = new AzureBackupInterfaceStoreAdapter('test-queue');
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
		mockPrismaCtx.prisma.prismaBackupRequest.findUnique.mockResolvedValue(dbBackupRequest);
		const brRepo = new PrismaBackupRequestRepo(prismaCtx, dbCircuitBreaker);
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
		const qAdapter = new AzureBackupInterfaceStoreAdapter('test-queue');
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
			expect(result.value.statusTypeCode).toBe(RequestStatusTypeValues.Sent);
			expect(result.value.sentToInterfaceTimestamp.valueOf()).toBeGreaterThan(startTimestamp.valueOf());
			// The use case doesn't check Base64 because it's tested in the adapter and the use case doesn't return bodyAsText to check
		}
	});

	// TODO: Add a test for adapter error
});
