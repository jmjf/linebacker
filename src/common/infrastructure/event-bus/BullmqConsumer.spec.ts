jest.mock('bullmq');
import * as bullMq from 'bullmq';

process.env.EVENT_BUS_TYPE = 'bullmq';
import { err, ok, Result } from '../../core/Result';
import { UseCase } from '../../application/UseCase';

import { BullmqConsumer } from './BullmqConsumer';
import { EventBusEvent } from './IEventBus';

interface TestEventData {
	event: {
		value: string;
	};
}

class TestUseCase implements UseCase<TestEventData, Promise<Result<TestEventData, Error>>> {
	public async execute(event: TestEventData) {
		return ok(event);
	}
}

describe('BmqConsumer', () => {
	const mockBullMq = jest.mocked(bullMq);
	const mockEvent = { event: { value: 'test event' } };
	let mockJob: bullMq.Job;

	beforeEach(() => {
		mockBullMq.Queue.mockClear();

		mockJob = {
			name: 'mockJob',
			id: 'mockJob-test',
			attemptsMade: 0,
			data: {
				connectFailureCount: 0,
				retryCount: 0,
				eventType: 'TestEvent',
				event: mockEvent,
			},
			update: async (data: unknown) => {
				mockJob.data = data;
			},
		} as unknown as bullMq.Job;
	});

	afterEach(async () => {
		//
	});

	test('when a handler fails for a connect error, it throws an EventBusError and increments counts', async () => {
		expect.assertions(4);
		// Arrange
		const ucError = new Error('connect error');
		(ucError as unknown as Record<string, unknown>)['errorData'] = { isConnectFailure: true };

		const useCase = new TestUseCase();
		useCase.execute = jest.fn().mockResolvedValue(err(ucError)); // use case will return connect error

		const consumer = new BullmqConsumer<TestUseCase>(useCase, 5);

		// Act
		try {
			const result = await consumer.consume(mockJob);
			console.log('unexpected success', result);
		} catch (e) {
			// Assert
			const err = e as any;
			expect(err.name).toEqual('EventBusError');
			expect(err.errorData.errorData.isConnectFailure).toBe(true);
			expect(mockJob.data.connectFailureCount).toEqual(1);
			expect(mockJob.data.retryCount).toEqual(1);
		}
	});

	test('when a job fails with non-connect error, it throws an EventBusError and increments retryCount, not connectFailureCount', async () => {
		expect.assertions(4);
		// Arrange
		const ucError = new Error('not connect error');
		(ucError as unknown as Record<string, unknown>)['errorData'] = { isConnectFailure: false };

		const useCase = new TestUseCase();
		useCase.execute = jest.fn().mockResolvedValue(err(ucError)); // use case will return connect error

		const consumer = new BullmqConsumer<TestUseCase>(useCase, 5);

		// Act
		try {
			const result = await consumer.consume(mockJob);
			console.log('unexpected success', result);
		} catch (e) {
			// Assert
			const err = e as any;
			expect(err.name).toEqual('EventBusError');
			expect(err.errorData.errorData.isConnectFailure).toBe(false);
			expect(mockJob.data.connectFailureCount).toEqual(0);
			expect(mockJob.data.retryCount).toEqual(1);
		}
	});

	test('when a job fails too many times, it throws an UnrecoverableError', async () => {
		expect.assertions(1);
		// Arrange
		const ucError = new Error('not connect error');
		(ucError as unknown as Record<string, unknown>)['errorData'] = { isConnectFailure: false };

		const useCase = new TestUseCase();
		useCase.execute = jest.fn().mockResolvedValue(err(ucError)); // use case will return connect error

		const consumer = new BullmqConsumer<TestUseCase>(useCase, mockJob.attemptsMade - 1);

		// Act
		try {
			const result = await consumer.consume(mockJob);
			console.log('unexpected success', result);
		} catch (e) {
			// Assert
			const err = e as Error;
			expect(err.constructor.name).toEqual('UnrecoverableError');
		}
	});

	test('when the use case throws an error, it rethrows the error', async () => {
		expect.assertions(1);
		// Arrange
		const errMessage = 'not connect error';
		const ucError = new Error(errMessage);
		(ucError as unknown as Record<string, unknown>)['errorData'] = { isConnectFailure: false };

		const useCase = new TestUseCase();
		useCase.execute = jest.fn().mockRejectedValue(ucError); // use case will return connect error

		const consumer = new BullmqConsumer<TestUseCase>(useCase, mockJob.attemptsMade);

		// Act
		try {
			const result = await consumer.consume(mockJob);
			console.log('unexpected success', result);
		} catch (e) {
			// Assert
			const err = e as Error;
			expect(err.message).toEqual(errMessage);
		}
	});

	test('when a job succeeds, it returns with no thrown errors', async () => {
		// Arrange
		const useCase = new TestUseCase();
		useCase.execute = jest.fn().mockResolvedValue(ok(mockEvent)); // use case will return connect error

		const consumer = new BullmqConsumer<TestUseCase>(useCase, mockJob.attemptsMade);

		// Act
		const result = await consumer.consume(mockJob);

		expect(result).toEqual(mockEvent);
	});
});
