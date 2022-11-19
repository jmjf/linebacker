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
		backupJobId: 'backup-job-id',
		dataDate: new Date('2022-05-01T01:02:03.456Z'),
		preparedDataPathName: 'prepared/data/path/name',
		getOnStartFlag: true,
		transportTypeCode: 'HTTP',
		statusTypeCode: 'Accepted',
		receivedTimestamp: new Date('2022-06-01T12:13:45.678Z'),
		requesterId: 'requester-id',
	};

	test('when a job fails too many times, it throws an UnrecoverableError', async () => {
		expect.assertions(1);

		mockTypeormCtx.manager.find.mockRejectedValue(new Error('database error'));
		const brRepo = new TypeormBackupRequestRepo(typeormCtx, dbCircuitBreaker);
		const useCase = new ReceiveBackupRequestUseCase(brRepo);

		const job = {
			data: {
				connectFailureCount: 0,
				request: { ...queueRequest },
			},
			attemptsMade: 999, // ensure failure for too many attempts
		} as unknown as bullMq.Job;

		const consumer = new AcceptedBackupRequestConsumer(useCase);

		try {
			const result = await consumer.consume(job);
			console.log('unexpected success', result);
		} catch (e) {
			const err = e as Error;
			expect(err.constructor.name).toEqual('UnrecoverableError');
		}
	});

	test('when called with a Job, it does something', async () => {
		mockTypeormCtx.manager.find.mockRejectedValue(new Error('database error'));
		const brRepo = new TypeormBackupRequestRepo(typeormCtx, dbCircuitBreaker);
		const useCase = new ReceiveBackupRequestUseCase(brRepo);

		const job = {
			data: {
				connectFailureCount: 0,
				request: { ...queueRequest },
			},
			attemptsMade: 0,
		} as unknown as bullMq.Job;

		const consumer = new AcceptedBackupRequestConsumer(useCase);

		const result = (await consumer.consume(job)) as any;

		expect(result.request.backupJobId).toEqual(queueRequest.backupJobId);
		expect(result.request.statusTypeCode).toEqual(RequestStatusTypeValues.Received);
	});
});
