import { ok } from '../../../common/core/Result';

import { CircuitBreakerWithRetry } from '../../../infrastructure/resilience/CircuitBreakerWithRetry';
import { TypeormBackupRequest } from '../../../infrastructure/typeorm/entity/TypeormBackupRequest.entity';
import {
	createMockTypeormContext,
	MockTypeormContext,
	TypeormContext,
} from '../../../infrastructure/typeorm/typeormContext';

import { getLenientCircuitBreaker } from '../../../test-helpers/circuitBreakerHelpers';

import { TypeormBackupRequestRepo } from '../../adapter/impl/TypeormBackupRequestRepo';
import { BackupRequestStatusTypeValues } from '../../domain/BackupRequestStatusType';
import { RequestTransportTypeValues } from '../../domain/RequestTransportType';

import { RestartStalledRequestsUseCase } from './RestartStalledRequestsUseCase';

describe('RestartStalledRequestsUseCase - typeorm', () => {
	let mockTypeormCtx: MockTypeormContext;
	let typeormCtx: TypeormContext;
	let circuitBreaker: CircuitBreakerWithRetry;
	let abortController: AbortController;

	beforeEach(() => {
		mockTypeormCtx = createMockTypeormContext();
		typeormCtx = mockTypeormCtx as unknown as TypeormContext;

		const isAlive = () => {
			return Promise.resolve(ok(true));
		};
		abortController = new AbortController();
		circuitBreaker = getLenientCircuitBreaker('TypeORM', abortController.signal);
	});

	afterEach(() => {
		circuitBreaker.halt();
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

	test('when allowed requests gets DatabaseError, it returns allowedResult err and receivedResult ok with two events', async () => {
		// Arrange
		mockTypeormCtx.manager.find.mockRejectedValueOnce(new Error('database error'));
		mockTypeormCtx.manager.find.mockResolvedValueOnce(dbReceivedResults);

		const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreaker);

		const useCase = new RestartStalledRequestsUseCase(backupRequestRepo, abortController.signal);

		// Act
		const result = await useCase.execute({ beforeTimestamp: new Date() });

		// Assert
		expect(result.allowedResult.isErr()).toBe(true);
		expect(result.receivedResult.isOk()).toBe(true);
		if (result.receivedResult.isOk()) {
			expect(result.receivedResult.value.length).toBe(2);
			expect(result.receivedResult.value[0].eventKey).toBe(dbReceivedResults[0].backupRequestId);
		}
	});

	test('when allowed requests gets NotFoundError, it returns allowsResult ok with zero events and receivedResult ok with two events', async () => {
		// Arrange
		mockTypeormCtx.manager.find.mockResolvedValueOnce([]);
		mockTypeormCtx.manager.find.mockResolvedValueOnce(dbReceivedResults);

		const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreaker);

		const useCase = new RestartStalledRequestsUseCase(backupRequestRepo, abortController.signal);

		// Act
		const result = await useCase.execute({ beforeTimestamp: new Date() });

		// Assert
		expect(result.allowedResult.isOk()).toBe(true);
		expect(result.receivedResult.isOk()).toBe(true);
		if (result.allowedResult.isOk()) {
			expect(result.allowedResult.value.length).toBe(0);
		}
		if (result.receivedResult.isOk()) {
			expect(result.receivedResult.value.length).toBe(2);
			expect(result.receivedResult.value[0].eventKey).toBe(dbReceivedResults[0].backupRequestId);
		}
	});

	test('when received requests gets DatabaseError, it returns allowedResult ok with two events and receivedResult err', async () => {
		// Arrange
		mockTypeormCtx.manager.find.mockResolvedValueOnce(dbAllowedResults);
		mockTypeormCtx.manager.find.mockRejectedValueOnce(new Error('database error'));

		const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreaker);

		const useCase = new RestartStalledRequestsUseCase(backupRequestRepo, abortController.signal);

		// Act
		const result = await useCase.execute({ beforeTimestamp: new Date() });

		// Assert
		expect(result.allowedResult.isOk()).toBe(true);
		expect(result.receivedResult.isErr()).toBe(true);
		if (result.allowedResult.isOk()) {
			expect(result.allowedResult.value.length).toBe(2);
			expect(result.allowedResult.value[0].eventKey).toBe(dbAllowedResults[0].backupRequestId);
		}
	});

	test('when received requests gets NotFoundError, it returns allowsResult ok with two events and receivedResult ok with zero events', async () => {
		// Arrange
		mockTypeormCtx.manager.find.mockResolvedValueOnce(dbAllowedResults);
		mockTypeormCtx.manager.find.mockResolvedValueOnce([]);

		const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreaker);

		const useCase = new RestartStalledRequestsUseCase(backupRequestRepo, abortController.signal);

		// Act
		const result = await useCase.execute({ beforeTimestamp: new Date() });

		// Assert
		expect(result.allowedResult.isOk()).toBe(true);
		expect(result.receivedResult.isOk()).toBe(true);
		if (result.receivedResult.isOk()) {
			expect(result.receivedResult.value.length).toBe(0);
		}
		if (result.allowedResult.isOk()) {
			expect(result.allowedResult.value.length).toBe(2);
			expect(result.allowedResult.value[0].eventKey).toBe(dbAllowedResults[0].backupRequestId);
		}
	});

	test('when allowed and received get results, it returns allowsResult ok with two events and receivedResult ok with two events', async () => {
		// Arrange
		mockTypeormCtx.manager.find.mockResolvedValueOnce(dbAllowedResults);
		mockTypeormCtx.manager.find.mockResolvedValueOnce(dbReceivedResults);

		const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreaker);

		const useCase = new RestartStalledRequestsUseCase(backupRequestRepo, abortController.signal);

		// Act
		const result = await useCase.execute({ beforeTimestamp: new Date() });

		// Assert
		expect(result.allowedResult.isOk()).toBe(true);
		expect(result.receivedResult.isOk()).toBe(true);
		if (result.allowedResult.isOk()) {
			expect(result.allowedResult.value.length).toBe(2);
			expect(result.allowedResult.value[0].eventKey).toBe(dbAllowedResults[0].backupRequestId);
		}
		if (result.receivedResult.isOk()) {
			expect(result.receivedResult.value.length).toBe(2);
			expect(result.receivedResult.value[0].eventKey).toBe(dbReceivedResults[0].backupRequestId);
		}
	});
});
