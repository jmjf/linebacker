jest.mock('bullmq');
import * as bullMq from 'bullmq';
const mockBullMq = jest.mocked(bullMq);

import { AcceptedBackupRequestConsumer } from './AcceptedBackupRequestConsumer';
import { TypeormBackupRequestRepo } from '../impl/TypeormBackupRequestRepo';
import {
	createMockTypeormContext,
	MockTypeormContext,
	TypeormContext,
} from '../../../infrastructure/typeorm/typeormContext';
import { CircuitBreakerWithRetry } from '../../../infrastructure/resilience/CircuitBreakerWithRetry';
import { getLenientCircuitBreaker } from '../../../test-helpers/circuitBreakerHelpers';
import { delay } from '../../../common/utils/utils';
import { ReceiveBackupRequestUseCase } from '../../use-cases/receive-backup-request/ReceiveBackupRequestUseCase';
import { RequestStatusTypeValues } from '../../domain/RequestStatusType';
import { BmqBackupRequestEventBus } from './BmqBackupRequestEventBus';
import { bullMqConnection } from '../../../infrastructure/bullmq/bullMqInfra';

describe('AcceptedBackupRequestConsumer - BullMq', () => {
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
		backupJobId: 'backup-job-id',
		dataDate: new Date('2022-05-01T01:02:03.456Z'),
		preparedDataPathName: 'prepared/data/path/name',
		getOnStartFlag: true,
		transportTypeCode: 'HTTP',
		statusTypeCode: 'Accepted',
		receivedTimestamp: new Date('2022-06-01T12:13:45.678Z'),
		requesterId: 'requester-id',
	};

	test('when a job fails with a connect error, it throws the expected error', async () => {
		// construct an error we'll see as a TypeORM connect error
		const connectError = new Error('connect error');
		(connectError as unknown as Record<string, string>)['code'] = 'ESOCKET';

		mockTypeormCtx.manager.findOne.mockRejectedValue(connectError);
		const brRepo = new TypeormBackupRequestRepo(typeormCtx, dbCircuitBreaker);
		const bmqBus = new BmqBackupRequestEventBus(bullMq, bullMqConnection);

		const useCase = new ReceiveBackupRequestUseCase(brRepo, bmqBus);

		const job = {
			data: {
				connectFailureCount: 0,
				event: { ...queueRequest },
			},
			attemptsMade: 0,
			update: async () => {
				return;
			},
		} as unknown as bullMq.Job;

		const consumer = new AcceptedBackupRequestConsumer(useCase, 5);

		try {
			const result = await consumer.consume(job);
			console.log('unexpected success', result);
		} catch (e) {
			const err = e as any;
			expect(err.name).toEqual('EventBusError');
			expect(err.message).toContain('connect');
		}
	});

	test('when a job fails too many times, it throws an UnrecoverableError', async () => {
		expect.assertions(1);

		mockTypeormCtx.manager.findOne.mockRejectedValue(new Error('database error'));
		const brRepo = new TypeormBackupRequestRepo(typeormCtx, dbCircuitBreaker);

		const bmqBus = new BmqBackupRequestEventBus(bullMq, bullMqConnection);

		const useCase = new ReceiveBackupRequestUseCase(brRepo, bmqBus);

		const job = {
			data: {
				connectFailureCount: 0,
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

		const consumer = new AcceptedBackupRequestConsumer(useCase, 1);

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
		const bmqBus = new BmqBackupRequestEventBus(bullMq, bullMqConnection);

		const useCase = new ReceiveBackupRequestUseCase(brRepo, bmqBus);

		const job = {
			data: {
				connectFailureCount: 0,
				event: { ...queueRequest },
			},
			attemptsMade: 0,
			update: async () => {
				return;
			},
		} as unknown as bullMq.Job;

		const consumer = new AcceptedBackupRequestConsumer(useCase, 5);

		try {
			const result = await consumer.consume(job);
			console.log('unexpected success', result);
		} catch (e) {
			const err = e as any;
			expect(err.name).toEqual('EventBusError');
			expect(err.message).toContain('other');
		}
	});

	test('when a job succeeds, it returns with no thrown errors', async () => {
		mockTypeormCtx.manager.findOne.mockResolvedValue(null);
		mockTypeormCtx.manager.save.mockResolvedValue({});
		const brRepo = new TypeormBackupRequestRepo(typeormCtx, dbCircuitBreaker);

		mockBullMq.Queue.prototype.add.mockResolvedValue({} as bullMq.Job);
		const bmqBus = new BmqBackupRequestEventBus(bullMq, bullMqConnection);

		const useCase = new ReceiveBackupRequestUseCase(brRepo, bmqBus);

		const job = {
			data: {
				connectFailureCount: 0,
				event: { ...queueRequest },
			},
			attemptsMade: 0,
			update: async () => {
				return;
			},
		} as unknown as bullMq.Job;

		const consumer = new AcceptedBackupRequestConsumer(useCase, 5);

		const result = await consumer.consume(job);
		expect(result.backupRequestId.value).toEqual(queueRequest.backupRequestId);
		expect(result.statusTypeCode).toEqual(RequestStatusTypeValues.Received);
	});
});
