jest.mock('bullmq');
import * as bullMq from 'bullmq';

process.env.EVENT_BUS_TYPE = 'bullmq';

import { eventBus } from '../../../common/infrastructure/event-bus/eventBus';
import * as InfrastructureErrors from '../../../common/infrastructure/InfrastructureErrors';

import { CircuitBreakerWithRetry } from '../../../infrastructure/resilience/CircuitBreakerWithRetry';
import { ok } from '../../../common/core/Result';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';

import { IBackupJobProps } from '../../../backup-job/domain/BackupJob';
import { BackupProviderTypeValues } from '../../../backup-job/domain/BackupProviderType';
import { MockBackupJobServiceAdapter } from '../../../backup-job/adapter/impl/MockBackupJobServiceAdapter';

import { BackupRequestStatusType, BackupRequestStatusTypeValues } from '../../domain/BackupRequestStatusType';
import { RequestTransportTypeValues } from '../../domain/RequestTransportType';

import { CheckRequestAllowedUseCase, CheckRequestAllowedDTO } from './CheckRequestAllowedUseCase';

import {
	MockTypeormContext,
	TypeormContext,
	createMockTypeormContext,
} from '../../../infrastructure/typeorm/typeormContext';
import { TypeormBackupRequestRepo } from '../../adapter/impl/TypeormBackupRequestRepo';
import { TypeormBackupRequest } from '../../../infrastructure/typeorm/entity/TypeormBackupRequest.entity';

describe('CheckRequestAllowedUseCase - typeorm', () => {
	let mockTypeormCtx: MockTypeormContext;
	let typeormCtx: TypeormContext;
	let circuitBreaker: CircuitBreakerWithRetry;
	let abortController: AbortController;

	const mockBullMq = jest.mocked(bullMq);
	const eventBusPublishSpy = jest.spyOn(eventBus, 'publishEvent');

	beforeEach(() => {
		mockTypeormCtx = createMockTypeormContext();
		typeormCtx = mockTypeormCtx as unknown as TypeormContext;

		mockBullMq.Queue.mockClear();
		eventBusPublishSpy.mockClear();

		const isAlive = () => {
			return Promise.resolve(ok(true));
		};
		abortController = new AbortController();
		circuitBreaker = new CircuitBreakerWithRetry({
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

	const baseDto: CheckRequestAllowedDTO = {
		backupRequestId: 'checkAllowedRequestId',
	};

	const backupJobProps: IBackupJobProps = {
		storagePathName: 'my/storage/path',
		backupProviderCode: BackupProviderTypeValues.CloudA,
		daysToKeep: 3650,
		isActive: true,
		holdFlag: false,
	};

	const dbBackupRequest: TypeormBackupRequest = {
		backupRequestId: 'dbBackupRequestId',
		backupJobId: 'dbBackupJobId',
		dataDate: new Date(),
		preparedDataPathName: 'path',
		getOnStartFlag: true,
		transportTypeCode: RequestTransportTypeValues.HTTP,
		statusTypeCode: BackupRequestStatusTypeValues.Received,
		receivedTimestamp: new Date(),
		requesterId: 'dbRequesterId',
		backupProviderCode: null,
		storagePathName: null,
		checkedTimestamp: null,
		sentToInterfaceTimestamp: null,
		replyTimestamp: null,
		replyMessageText: null,
	};

	test('when backup request is not found by id, it returns failure', async () => {
		// Arrange
		// findOne() returns null if not found
		mockTypeormCtx.manager.findOne.mockResolvedValueOnce(null);

		const brRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreaker);
		const saveSpy = jest.spyOn(brRepo, 'save');

		const jobSvc = new MockBackupJobServiceAdapter({
			getByIdError: new AdapterErrors.NotFoundError(
				`{ msg: 'backupJobId not found for backupRequestId ${baseDto.backupRequestId}'`
			),
		});

		mockBullMq.Queue.prototype.add.mockResolvedValue({} as bullMq.Job);

		const useCase = new CheckRequestAllowedUseCase(brRepo, jobSvc, eventBus);
		const dto = { ...baseDto };

		// Act
		const result = await useCase.execute(dto);

		// Assert
		expect(result.isErr()).toBe(true);
		expect(saveSpy).not.toHaveBeenCalled();
		expect(eventBusPublishSpy).not.toHaveBeenCalled();
		if (result.isErr()) {
			// type guard
			expect(result.error.name).toBe('NotFoundError');
			expect((result.error.errorData as any).backupRequestId).toMatch(dto.backupRequestId);
		}
	});

	test('when backup job is not found, it returns failure', async () => {
		// Arrange
		mockTypeormCtx.manager.findOne.mockResolvedValueOnce(dbBackupRequest);

		const brRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreaker);
		const saveSpy = jest.spyOn(brRepo, 'save');

		const jobSvc = new MockBackupJobServiceAdapter({
			getByIdError: new AdapterErrors.BackupJobServiceError(`{msg: 'backupJobId not found' }`),
		});

		mockBullMq.Queue.prototype.add.mockResolvedValue({} as bullMq.Job);

		const useCase = new CheckRequestAllowedUseCase(brRepo, jobSvc, eventBus);
		const dto = { ...baseDto };

		// Act
		const result = await useCase.execute(dto);

		// Assert
		expect(result.isErr()).toBe(true);
		expect(saveSpy).not.toHaveBeenCalled();
		expect(eventBusPublishSpy).not.toHaveBeenCalled();
		if (result.isErr()) {
			// type guard
			expect(result.error.name).toBe('BackupJobServiceError');
			// future test message too
		}
	});

	test('when request status type is invalid, it returns failure', async () => {
		// Arrange
		mockTypeormCtx.manager.findOne.mockResolvedValueOnce({
			...dbBackupRequest,
			statusTypeCode: 'INVALID',
		});

		const brRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreaker);
		const saveSpy = jest.spyOn(brRepo, 'save');

		const jobSvc = new MockBackupJobServiceAdapter({ getByIdResult: { ...backupJobProps } });

		mockBullMq.Queue.prototype.add.mockResolvedValue({} as bullMq.Job);

		const useCase = new CheckRequestAllowedUseCase(brRepo, jobSvc, eventBus);
		const dto = { ...baseDto };

		// Act
		const result = await useCase.execute(dto);

		// Assert
		expect(result.isErr()).toBe(true);
		expect(saveSpy).not.toHaveBeenCalled();
		expect(eventBusPublishSpy).not.toHaveBeenCalled();
		if (result.isErr()) {
			// type guard
			expect(result.error.name).toBe('BackupRequestStatusError');
			expect((result.error.errorData as any).statusTypeCode).toMatch('INVALID');
		}
	});

	// // test.each(statusTestCases) runs the same test with different data (defined in statusTestCases)
	// I had to coerce several types to get the test to behave, but now this one block of code tests all the cases
	const statusTestCases = [
		{
			status: BackupRequestStatusTypeValues.NotAllowed,
			timestamp: 'checkedTimestamp',
		},
		{
			status: BackupRequestStatusTypeValues.Sent,
			timestamp: 'sentToInterfaceTimestamp',
		},
		{
			status: BackupRequestStatusTypeValues.Succeeded,
			timestamp: 'replyTimestamp',
		},
		{ status: BackupRequestStatusTypeValues.Failed, timestamp: 'replyTimestamp' },
	];
	test.each(statusTestCases)(
		'when backup request is in $status status, it returns an err (must be Received)',
		async ({ status, timestamp }) => {
			// Arrange
			// timestamp that matters is defined in inputs, so need to add it after setting up base props
			const resultBackupRequest: Record<string, any> = {
				...dbBackupRequest,
				statusTypeCode: status as BackupRequestStatusType,
			};
			resultBackupRequest[timestamp] = new Date();

			mockTypeormCtx.manager.findOne.mockResolvedValueOnce(resultBackupRequest);

			const brRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreaker);
			const saveSpy = jest.spyOn(brRepo, 'save');

			const jobSvc = new MockBackupJobServiceAdapter({ getByIdResult: { ...backupJobProps } });

			mockBullMq.Queue.prototype.add.mockResolvedValue({} as bullMq.Job);

			const useCase = new CheckRequestAllowedUseCase(brRepo, jobSvc, eventBus);
			const dto = { ...baseDto };

			// Act
			const result = await useCase.execute(dto);

			// Assert
			expect(result.isErr()).toBe(true);
			expect(saveSpy).not.toHaveBeenCalled();
			expect(eventBusPublishSpy).not.toHaveBeenCalled();
			if (result.isErr()) {
				// type guard
				expect(result.error.name).toBe('BackupRequestStatusError');
				expect((result.error.errorData as any).statusTypeCode).toContain(status);
			}
		}
	);

	test('when event bus publish fails, it saves and returns an EventBusError', async () => {
		// Arrange
		mockTypeormCtx.manager.findOne.mockResolvedValueOnce(dbBackupRequest);
		mockTypeormCtx.manager.save.mockResolvedValueOnce({} as TypeormBackupRequest);

		const brRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreaker);
		const saveSpy = jest.spyOn(brRepo, 'save');

		const jobSvc = new MockBackupJobServiceAdapter({
			getByIdResult: { ...backupJobProps },
		});

		mockBullMq.Queue.prototype.add.mockRejectedValue(
			new InfrastructureErrors.EventBusError('simulated event bus error')
		);

		const useCase = new CheckRequestAllowedUseCase(brRepo, jobSvc, eventBus);
		const dto = { ...baseDto };

		// Act
		const result = await useCase.execute(dto);

		// Assert
		expect(result.isErr()).toBe(true);
		expect(saveSpy).toHaveBeenCalledTimes(1);
		expect(eventBusPublishSpy).toHaveBeenCalledTimes(1);
		if (result.isErr()) {
			// type guard makes the rest easier
			expect(result.error.name).toBe('EventBusError');
		}
	});

	test('when backup request is Received and meets allowed rules, it saves, publishes, and returns a BackupRequest in Allowed status', async () => {
		// Arrange
		mockTypeormCtx.manager.findOne.mockResolvedValueOnce(dbBackupRequest);
		mockTypeormCtx.manager.save.mockResolvedValueOnce({} as TypeormBackupRequest);

		const brRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreaker);
		const saveSpy = jest.spyOn(brRepo, 'save');

		const jobSvc = new MockBackupJobServiceAdapter({
			getByIdResult: { ...backupJobProps },
		});

		mockBullMq.Queue.prototype.add.mockResolvedValue({} as bullMq.Job);

		const useCase = new CheckRequestAllowedUseCase(brRepo, jobSvc, eventBus);
		const dto = { ...baseDto };

		// Act
		const startTimestamp = new Date();
		const result = await useCase.execute(dto);

		// Assert
		expect(result.isOk()).toBe(true);
		expect(saveSpy).toHaveBeenCalledTimes(1);
		expect(eventBusPublishSpy).toHaveBeenCalledTimes(1);
		if (result.isOk()) {
			// type guard makes the rest easier
			expect(result.value.statusTypeCode).toBe(BackupRequestStatusTypeValues.Allowed);
			expect(result.value.checkedTimestamp.valueOf()).toBeGreaterThanOrEqual(startTimestamp.valueOf());
		}
	});

	test('when backup job for request is Allowed, it publishes and returns a BackupRequest in Allowed status, does not save', async () => {
		// Arrange
		mockTypeormCtx.manager.findOne.mockResolvedValueOnce({
			...dbBackupRequest,
			statusTypeCode: BackupRequestStatusTypeValues.Allowed,
			checkedTimestamp: new Date(),
		});
		mockTypeormCtx.manager.save.mockResolvedValueOnce({} as TypeormBackupRequest);

		const brRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreaker);
		const saveSpy = jest.spyOn(brRepo, 'save');

		const jobSvc = new MockBackupJobServiceAdapter({
			getByIdResult: { ...backupJobProps },
		});

		mockBullMq.Queue.prototype.add.mockResolvedValue({} as bullMq.Job);

		const useCase = new CheckRequestAllowedUseCase(brRepo, jobSvc, eventBus);
		const dto = { ...baseDto };

		// Act
		const result = await useCase.execute(dto);

		// Assert
		expect(result.isOk()).toBe(true);
		expect(saveSpy).not.toHaveBeenCalled();
		expect(eventBusPublishSpy).toHaveBeenCalledTimes(1);
		if (result.isOk()) {
			expect(result.value.backupRequestId).toBeTruthy();
		}
	});
});
