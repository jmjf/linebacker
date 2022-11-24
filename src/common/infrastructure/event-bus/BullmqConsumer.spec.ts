jest.mock('bullmq');
import * as bullMq from 'bullmq';
const mockBullMq = jest.mocked(bullMq);

import { bullmqEventBus } from './BullmqEventBus';
import { BullmqConsumer } from './BullmqConsumer';

import {
	createMockTypeormContext,
	MockTypeormContext,
	TypeormContext,
} from '../../../infrastructure/typeorm/typeormContext';
import { CircuitBreakerWithRetry } from '../../../infrastructure/resilience/CircuitBreakerWithRetry';

import { BackupRequestStatusTypeValues } from '../../../backup-request/domain/BackupRequestStatusType';
import { TypeormBackupRequestRepo } from '../../../backup-request/adapter/impl/TypeormBackupRequestRepo';
import { CheckRequestAllowedUseCase } from '../../../backup-request/use-cases/check-request-allowed-2/CheckRequestAllowedUseCase';
import { MockBackupJobServiceAdapter } from '../../../backup-job/adapter/impl/MockBackupJobServiceAdapter';
import { IBackupJobProps } from '../../../backup-job/domain/BackupJob';
import { BackupProviderTypeValues } from '../../../backup-job/domain/BackupProviderType';

import { getLenientCircuitBreaker } from '../../../test-helpers/circuitBreakerHelpers';
import { delay } from '../../utils/utils';

describe('BmqConsumer - runs with CheckRequestAllowedUseCase', () => {
	let mockTypeormCtx: MockTypeormContext;
	let typeormCtx: TypeormContext;

	let dbCircuitBreaker: CircuitBreakerWithRetry;
	let abortController: AbortController;

	beforeEach(() => {
		mockTypeormCtx = createMockTypeormContext();
		typeormCtx = mockTypeormCtx as unknown as TypeormContext;

		mockBullMq.Queue.mockClear();

		abortController = new AbortController();
		dbCircuitBreaker = getLenientCircuitBreaker('TypeORM', abortController.signal);
	});

	afterEach(async () => {
		abortController.abort();
		await delay(250);
	});

	const queueRequest = {
		backupRequestId: 'backup-request-id',
	};

	const rawBackupRequest = {
		backupRequestId: 'backup-request-id',
		backupJobId: 'backup-job-id',
		dataDate: new Date('2022-05-01T01:02:03.456Z'),
		preparedDataPathName: 'prepared/data/path/name',
		getOnStartFlag: true,
		transportTypeCode: 'HTTP',
		statusTypeCode: 'Received',
		receivedTimestamp: new Date('2022-06-01T12:13:45.678Z'),
		requesterId: 'requester-id',
	};

	const backupJobProps: IBackupJobProps = {
		storagePathName: 'my/storage/path',
		backupProviderCode: BackupProviderTypeValues.CloudA,
		daysToKeep: 3650,
		isActive: true,
		holdFlag: false,
	};

	test('when a job fails with a connect error, it throws the expected error', async () => {
		// construct an error we'll see as a TypeORM connect error
		const connectError = new Error('connect error');
		(connectError as unknown as Record<string, string>)['code'] = 'ESOCKET';

		mockTypeormCtx.manager.findOne.mockRejectedValue(connectError);
		const brRepo = new TypeormBackupRequestRepo(typeormCtx, dbCircuitBreaker);
		const jobSvc = new MockBackupJobServiceAdapter({
			getByIdResult: { ...backupJobProps },
		});

		const useCase = new CheckRequestAllowedUseCase(brRepo, jobSvc, bullmqEventBus);

		const job = {
			data: {
				connectFailureCount: 0,
				retryCount: 0,
				eventName: 'BackupRequestReceived',
				event: { ...queueRequest },
			},
			attemptsMade: 0,
			update: async () => {
				return;
			},
		} as unknown as bullMq.Job;

		const consumer = new BullmqConsumer(useCase, 5);

		try {
			const result = await consumer.consume(job);
			console.log('unexpected success', result);
		} catch (e) {
			const err = e as any;
			expect(err.name).toEqual('EventBusError');
			expect(err.message.toLowerCase()).toContain('connect');
		}
	});

	test('when a job fails too many times, it throws an UnrecoverableError', async () => {
		expect.assertions(1);

		mockTypeormCtx.manager.findOne.mockRejectedValue(new Error('database error'));
		const brRepo = new TypeormBackupRequestRepo(typeormCtx, dbCircuitBreaker);
		const jobSvc = new MockBackupJobServiceAdapter({
			getByIdResult: { ...backupJobProps },
		});

		const useCase = new CheckRequestAllowedUseCase(brRepo, jobSvc, bullmqEventBus);

		const job = {
			data: {
				connectFailureCount: 0,
				retryCount: 0,
				eventName: 'BackupRequestReceived',
				event: {
					...queueRequest,
					transportTypeCode: 'INVALID', // cause use case to fail
				},
			},
			attemptsMade: 999, // ensure failure for too many attempts
			update: async () => {
				return;
			},
		} as unknown as bullMq.Job;

		const consumer = new BullmqConsumer(useCase, 1);

		try {
			const result = await consumer.consume(job);
			console.log('unexpected success', result);
		} catch (e) {
			const err = e as Error;
			expect(err.constructor.name).toEqual('UnrecoverableError');
		}
	});

	test('when a job fails with a general error, it throws the expected error', async () => {
		mockTypeormCtx.manager.findOne.mockRejectedValue(new Error('database error'));
		const brRepo = new TypeormBackupRequestRepo(typeormCtx, dbCircuitBreaker);
		const jobSvc = new MockBackupJobServiceAdapter({
			getByIdResult: { ...backupJobProps },
		});

		const useCase = new CheckRequestAllowedUseCase(brRepo, jobSvc, bullmqEventBus);

		const job = {
			data: {
				connectFailureCount: 0,
				retryCount: 0,
				eventName: 'BackupRequestReceived',
				event: { ...queueRequest },
			},
			attemptsMade: 0,
			update: async () => {
				return;
			},
		} as unknown as bullMq.Job;

		const consumer = new BullmqConsumer(useCase, 5);

		try {
			const result = await consumer.consume(job);
			console.log('unexpected success', result);
		} catch (e) {
			const err = e as any;
			expect(err.name).toEqual('EventBusError');
			expect(err.message.toLowerCase()).toContain('other');
		}
	});

	test('when a job succeeds, it returns with no thrown errors', async () => {
		mockTypeormCtx.manager.findOne.mockResolvedValue(rawBackupRequest);
		mockTypeormCtx.manager.save.mockResolvedValue({});
		const brRepo = new TypeormBackupRequestRepo(typeormCtx, dbCircuitBreaker);
		const jobSvc = new MockBackupJobServiceAdapter({
			getByIdResult: { ...backupJobProps },
		});
		mockBullMq.Queue.prototype.add.mockResolvedValue({} as bullMq.Job);

		const useCase = new CheckRequestAllowedUseCase(brRepo, jobSvc, bullmqEventBus);

		const job = {
			data: {
				connectFailureCount: 0,
				retryCount: 0,
				eventName: 'BackupRequestReceived',
				event: { ...queueRequest },
			},
			attemptsMade: 0,
			update: async () => {
				return;
			},
		} as unknown as bullMq.Job;

		const consumer = new BullmqConsumer(useCase, 5);

		const result = await consumer.consume(job);

		expect(result.backupRequestId.value).toEqual(queueRequest.backupRequestId);
		expect(result.statusTypeCode).toEqual(BackupRequestStatusTypeValues.Allowed);
	});
});
