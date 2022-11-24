import { Result, ok } from '../../common/core/Result';
import { BaseError } from '../../common/core/BaseError';
import { EventBusEvent, IEventBusSubscriber } from '../../common/infrastructure/event-bus/IEventBus';
import { UniqueIdentifier } from '../../common/domain/UniqueIdentifier';
import { UseCase } from '../../common/application/UseCase';

import { delay } from '../../common/utils/utils';
import { DelayedEventRunner } from './DelayedEventRunner';

import { TestUseCaseDTO, TestEvent } from '../../test-helpers/ResilienceTestTypes';
import { eventBus } from '../../common/infrastructure/event-bus/eventBus';

const VERBOSE_LOGS = false; // set true to get verbose console.logs for event tracing
// this test suite isn't concerned about the adapter or service behavior, so only needs to check calls to the use case

class TestUseCase implements UseCase<TestUseCaseDTO, Result<boolean, BaseError>> {
	// private testAdapter: TestAdapter;

	constructor() {
		//testAdapter: TestAdapter) {
		//this.testAdapter = testAdapter;
	}

	public async execute(request: TestUseCaseDTO): Promise<Result<boolean, BaseError>> {
		if (VERBOSE_LOGS) console.log('TestUseCase request', request);
		// return await this.testAdapter.test();
		return ok(true);
	}
}


class TestSubscriber implements IEventBusSubscriber<TestEvent> {
	private useCase: TestUseCase;
	private failedServices: Record<string, any> = {};

	constructor(useCase: TestUseCase) {
		this.setupSubscriptions();
		this.useCase = useCase;
	}

	setupSubscriptions(): void {
		eventBus.subscribe(TestEvent.name, this.onEvent.bind(this));
	}

	public get failedServiceNames() {
		return Object.keys(this.failedServices);
	}

	async onEvent(event: TestEvent): Promise<void> {
		const key = event.eventKey;
		const eventName = event.constructor.name;

		if (VERBOSE_LOGS) console.log('subscriber event', key, event.retryCount, this.failedServiceNames);

		if (Object.keys(this.failedServices).length > 0) {
			// have connection checks
			for (const serviceName in this.failedServices) {
				if (VERBOSE_LOGS)
					console.log(
						'subscriber connection check for',
						key,
						serviceName,
						this.failedServices[serviceName].isConnected()
					);
				if (!this.failedServices[serviceName].isConnected()) {
					event.incrementRetryCount();
					this.failedServices[serviceName].addRetryEvent(event);
					return; // something is down so no need to check further
				}

				// if it doesn't fail, don't need to check again
				delete this.failedServices[serviceName];
			}
		}
		try {
			const result = await this.useCase.execute({ id: key, retryCount: event.retryCount });

			if (result.isErr()) {
				if (VERBOSE_LOGS)
					console.log('subscriber use case error', key, event.retryCount, result.error.message);
				const errorData = result.error.errorData as any;
				if (errorData.isConnectFailure) {
					if (errorData.serviceName && errorData.isConnected && !this.failedServices[errorData.serviceName]) {
						this.failedServices[errorData.serviceName] = { isConnected: undefined, addRetryEvent: undefined };
						this.failedServices[errorData.serviceName].isConnected = errorData.isConnected;
						this.failedServices[errorData.serviceName].addRetryEvent = errorData.addRetryEvent;
					}
					if (errorData.addRetryEvent) {
						event.incrementRetryCount();
						errorData.addRetryEvent(event);
					}
				}
			} else {
				if (VERBOSE_LOGS) console.log('subscriber use case ok', key, event.retryCount);
			}
		} catch (e) {
			const { message, ...error } = e as BaseError;
			console.log('subscriber error', message, error);
		}
	}
}

function getEvent(id: string) {
	return new TestEvent(new UniqueIdentifier(id));
}

describe('DelayedEventRunner', () => {
	test('when no events are set up for retry, calling runEvents() does not run the use case', async () => {
		// Arrange
		const abortController = new AbortController();

		const delayedEventRunner = new DelayedEventRunner(abortController.signal, 20);
		const useCase = new TestUseCase();
		const subscriber = new TestSubscriber(useCase);
		const useCaseSpy = jest.spyOn(useCase, 'execute');

		// Act
		delayedEventRunner.runEvents();
		await delay(50);

		// Assert
		// use case should not run because no events
		expect(useCaseSpy).toBeCalledTimes(0);
	});

	test('when events are set up for retry and DER is in Run state, runEvents() does not run', async () => {
		// does not run because if DER is in Run state, it's already running; running twice can cause problems

		// Arrange
		const abortController = new AbortController();

		const delayedEventRunner = new DelayedEventRunner(abortController.signal, 20);
		const useCase = new TestUseCase();
		const subscriber = new TestSubscriber(useCase);
		const useCaseSpy = jest.spyOn(useCase, 'execute');

		delayedEventRunner.addEvent(new TestEvent(new UniqueIdentifier('test-event-1')));
		delayedEventRunner.addEvent(new TestEvent(new UniqueIdentifier('test-event-2')));
		delayedEventRunner.setStateRun();

		// Act
		delayedEventRunner.runEvents();
		await delay(50);

		expect(delayedEventRunner.eventCount).toBe(2);
		expect(delayedEventRunner.isStateRun()).toBe(true);
		// retryEvents() exits before publishing events, so use case won't run in this test
		expect(useCaseSpy).toBeCalledTimes(0);

		// Cleanup
		eventBus.clearHandlers();
		abortController.abort();
		delay(20);
	});

	test('when events are set up for retry and DER is in Stop state, runEvents() runs events', async () => {
		// Arrange
		const abortController = new AbortController();

		const delayedEventRunner = new DelayedEventRunner(abortController.signal, 20);
		const useCase = new TestUseCase();
		const subscriber = new TestSubscriber(useCase);
		const useCaseSpy = jest.spyOn(useCase, 'execute');

		delayedEventRunner.addEvent(new TestEvent(new UniqueIdentifier('test-event-1')));
		delayedEventRunner.addEvent(new TestEvent(new UniqueIdentifier('test-event-2')));
		// DER is in Stop state on create, so no need to set state

		// Act
		delayedEventRunner.runEvents();
		await delay(50);

		// Assert
		expect(useCaseSpy).toBeCalledTimes(2);
		expect(delayedEventRunner.eventCount).toBe(0);

		// Cleanup
		eventBus.clearHandlers();
		abortController.abort();
		delay(20);
	});
});
