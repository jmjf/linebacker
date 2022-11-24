import { ok } from '../../common/core/Result';

import { eventBus } from '../../common/infrastructure/event-bus/eventBus';
import { UniqueIdentifier } from '../../common/domain/UniqueIdentifier';

import { CircuitBreakerStateValues, CircuitBreakerWithRetry } from './CircuitBreakerWithRetry';
import { delay } from '../../common/utils/utils';

import { TestEvent, TestAdapter, TestUseCase, TestService, TestSubscriber } from '../../test-helpers/ResilienceTestTypes';

const VERBOSE_LOGS = false; // set true to get verbose console.logs for event tracing


function getEvent(id: string) {
	return new TestEvent(new UniqueIdentifier(id));
}

describe('CircuitBreakerWithRetry', () => {
	test('when circuit breaker is halted, its state is Halted and retryEvents is cleared', async () => {
		// Arrange
		const abortController = new AbortController();

		const circuitBreaker = new CircuitBreakerWithRetry({
			isAlive: () => Promise.resolve(ok(true)),
			abortSignal: abortController.signal,
			serviceName: 'TestService',
			successToCloseCount: 10,
			failureToOpenCount: 1,
			halfOpenRetryDelayMs: 5,
			closedRetryDelayMs: 5,
			openAliveCheckDelayMs: 50,
		});

		// Act
		circuitBreaker.addRetryEvent(getEvent('halt test-Event-1'));
		await delay(25);
		expect(circuitBreaker.retryEventCount).toBe(1);

		circuitBreaker.halt();

		// Assert
		expect(circuitBreaker.state).toBe(CircuitBreakerStateValues.Halted);
		expect(circuitBreaker.retryEventCount).toBe(0);

		abortController.abort();
	});

	test('when the service returns a connect failure, the circuit moves to Open', async () => {
		// Arrange
		const abortController = new AbortController();

		const service = new TestService();
		service.setTestResult(false); // test() will fail
		service.setLiveness(false);

		const circuitBreaker = new CircuitBreakerWithRetry({
			isAlive: service.isAlive.bind(service),
			abortSignal: abortController.signal,
			serviceName: 'TestService',
			successToCloseCount: 10,
			failureToOpenCount: 1,
			halfOpenRetryDelayMs: 5,
			closedRetryDelayMs: 5,
			openAliveCheckDelayMs: 5,
		});

		const adapter = new TestAdapter(service, circuitBreaker);

		// Act
		expect(circuitBreaker.state).toBe(CircuitBreakerStateValues.HalfOpen);
		const result = await adapter.test();

		// Assert
		expect(circuitBreaker.state).toBe(CircuitBreakerStateValues.Open);
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			// proves it doesn't fast fail
			expect(result.error.message).toContain('connect failure');
			expect((result.error.errorData as any).isConnectFailure).toBe(true);
			expect((result.error.errorData as any).isConnected()).toBe(false);
		}

		abortController.abort();
		circuitBreaker.halt();
	});

	test('when the circuit is Open, the adapter can fail fast', async () => {
		// Arrange
		const abortController = new AbortController();

		const service = new TestService();
		service.setTestResult(false); // test() will fail
		service.setLiveness(false);

		const circuitBreaker = new CircuitBreakerWithRetry({
			isAlive: service.isAlive.bind(service),
			abortSignal: abortController.signal,
			serviceName: 'TestService',
			successToCloseCount: 10,
			failureToOpenCount: 1,
			halfOpenRetryDelayMs: 5,
			closedRetryDelayMs: 5,
			openAliveCheckDelayMs: 50,
		});

		const adapter = new TestAdapter(service, circuitBreaker);

		// Act
		expect(circuitBreaker.state).toBe(CircuitBreakerStateValues.HalfOpen);
		const result1 = await adapter.test();

		const result = await adapter.test();

		// Assert
		expect(circuitBreaker.state).toBe(CircuitBreakerStateValues.Open);
		expect(result1.isErr()).toBe(true);
		if (result1.isErr()) {
			expect(result1.error.message).toContain('connect failure');
		}
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			// proves it can fast fail
			expect(result.error.message).toContain('fast fail');
			expect((result.error.errorData as any).isConnectFailure).toBe(true);
			expect((result.error.errorData as any).isConnected()).toBe(false);
		}

		circuitBreaker.halt();
		abortController.abort();
	});

	test('when the circuit is Open, it checks until the connection is restored then moves to HalfOpen', async () => {
		// Arrange
		const abortController = new AbortController();
		const service = new TestService();
		service.setTestResult(false); // test() will fail
		service.setLiveness(false);

		const circuitBreaker = new CircuitBreakerWithRetry({
			isAlive: service.isAlive.bind(service),
			abortSignal: abortController.signal,
			serviceName: 'TestService',
			successToCloseCount: 10,
			failureToOpenCount: 1,
			halfOpenRetryDelayMs: 500,
			closedRetryDelayMs: 500,
			openAliveCheckDelayMs: 10,
		});

		const adapter = new TestAdapter(service, circuitBreaker);

		// Act
		expect(circuitBreaker.state).toBe(CircuitBreakerStateValues.HalfOpen);
		const result = await adapter.test();

		// Assert
		expect(circuitBreaker.state).toBe(CircuitBreakerStateValues.Open);
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect((result.error.errorData as any).isConnectFailure).toBe(true);
			expect((result.error.errorData as any).isConnected()).toBe(false);
		}

		// for first time testing, I added a console.log() in awaitIsAlive()
		// so I could see it running; after a few loops, set alive and give it
		// a few ms to see the change
		await delay(50);
		service.setLiveness(true);
		await delay(50);

		expect(circuitBreaker.state).toBe(CircuitBreakerStateValues.HalfOpen);
		if (result.isErr()) {
			// Half open should give connected
			expect((result.error.errorData as any).isConnected()).toBe(true);
		}

		circuitBreaker.halt();
		abortController.abort();
	});

	test('when the circuit is HalfOpen and successful calls reaches the threshold, it moves to Closed', async () => {
		// Arrange
		const abortController = new AbortController();

		const service = new TestService();
		service.setTestResult(false); // test() will fail
		service.setLiveness(false);

		const circuitBreaker = new CircuitBreakerWithRetry({
			isAlive: service.isAlive.bind(service),
			abortSignal: abortController.signal,
			serviceName: 'TestService',
			successToCloseCount: 2,
			failureToOpenCount: 1,
			halfOpenRetryDelayMs: 5,
			closedRetryDelayMs: 5,
			openAliveCheckDelayMs: 5,
		});

		const adapter = new TestAdapter(service, circuitBreaker);

		// Act
		expect(circuitBreaker.state).toBe(CircuitBreakerStateValues.HalfOpen);
		const result = await adapter.test();

		// Assert
		expect(circuitBreaker.state).toBe(CircuitBreakerStateValues.Open);
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect((result.error.errorData as any).isConnectFailure).toBe(true);
			expect((result.error.errorData as any).isConnected()).toBe(false);
		}

		// let awaitIsAlive see the service is alive
		service.setLiveness(true);
		await delay(25);

		expect(circuitBreaker.state).toBe(CircuitBreakerStateValues.HalfOpen);
		if (result.isErr()) {
			// Half open should be give connected
			expect((result.error.errorData as any).isConnected()).toBe(true);
		}

		// remaining calls will succeed
		service.setTestResult(true);

		// threshold requires 2 successes to close the circuit, so half open still
		const result1 = await adapter.test();
		expect(result1.isOk()).toBe(true);
		expect(circuitBreaker.state).toBe(CircuitBreakerStateValues.HalfOpen);

		// second success, so open now
		const result2 = await adapter.test();
		expect(result2.isOk()).toBe(true);
		expect(circuitBreaker.state).toBe(CircuitBreakerStateValues.Closed);

		circuitBreaker.halt();
		abortController.abort();
	});

	test('when addRetryEvent is called, it adds an event for retry', async () => {
		// Arrange
		const abortController = new AbortController();

		const service = new TestService();
		service.setTestResult(false);
		service.setLiveness(false);

		const circuitBreaker = new CircuitBreakerWithRetry({
			isAlive: service.isAlive.bind(service),
			abortSignal: abortController.signal,
			serviceName: 'TestService',
			successToCloseCount: 2,
			failureToOpenCount: 1,
			halfOpenRetryDelayMs: 5,
			closedRetryDelayMs: 5,
			openAliveCheckDelayMs: 5,
		});
		circuitBreaker.onFailure();

		// Act
		circuitBreaker.addRetryEvent(getEvent('addRetryEvent-Event-1'));
		circuitBreaker.addRetryEvent(getEvent('addRetryEvent-Event-2'));
		circuitBreaker.addRetryEvent(getEvent('addRetryEvent-Event-3'));

		// Assert
		expect(circuitBreaker.retryEventCount).toBe(3);

		circuitBreaker.halt();
		abortController.abort();
	});

	test('when the circuit is Open, the subscriber can fail fast', async () => {
		// Arrange
		const abortController = new AbortController();

		const service = new TestService();
		service.setTestResult(false);
		service.setLiveness(false);

		const circuitBreaker = new CircuitBreakerWithRetry({
			isAlive: service.isAlive.bind(service),
			abortSignal: abortController.signal,
			serviceName: 'TestService',
			successToCloseCount: 2,
			failureToOpenCount: 1,
			halfOpenRetryDelayMs: 5,
			closedRetryDelayMs: 5,
			openAliveCheckDelayMs: 20,
		});
		circuitBreaker.onFailure();
		expect(circuitBreaker.state).toBe(CircuitBreakerStateValues.Open);

		const adapter = new TestAdapter(service, circuitBreaker);

		const useCase = new TestUseCase(adapter);
		const useCaseSpy = jest.spyOn(useCase, 'execute');

		const subscriber = new TestSubscriber(useCase);
		// can't spy on onEvent

		// Act
		// First call, subscriber doesn't know service is down, so calls use case
		eventBus.publishEvent(getEvent('subscriber fast fail-Event-1'));
		await delay(100); // give event time to run

		// Assert
		expect(useCaseSpy).toHaveBeenCalledTimes(1);
		expect(circuitBreaker.state).toBe(CircuitBreakerStateValues.Open);
		expect(subscriber.failedServiceNames.length).toBe(1);
		useCaseSpy.mockClear(); // reset counters on the spy

		// Act
		// Second call, subscriber learned service is down, so will fail fast if liveness check fails
		eventBus.publishEvent(getEvent('subscriber fast fail-Event-2'));
		await delay(50); // give it time to run

		// Assert
		expect(useCaseSpy).not.toHaveBeenCalled();
		expect(subscriber.failedServiceNames.length).toBe(1);

		// Cleanup
		eventBus.clearHandlers();

		circuitBreaker.halt();
		abortController.abort();
		await delay(100); // allow time for anything running to finish
	});

	test('when the circuit is Open and an event arrives at the subscriber, the event is added for retry', async () => {
		// Arrange
		const abortController = new AbortController();

		const service = new TestService();
		service.setTestResult(false);
		service.setLiveness(false);

		const circuitBreaker = new CircuitBreakerWithRetry({
			isAlive: service.isAlive.bind(service),
			abortSignal: abortController.signal,
			serviceName: 'TestService',
			successToCloseCount: 2,
			failureToOpenCount: 1,
			halfOpenRetryDelayMs: 5,
			closedRetryDelayMs: 5,
			openAliveCheckDelayMs: 20,
		});
		// make circuit Open
		circuitBreaker.onFailure();
		await delay(20);
		expect(circuitBreaker.state).toBe(CircuitBreakerStateValues.Open);

		const adapter = new TestAdapter(service, circuitBreaker);

		const useCase = new TestUseCase(adapter);
		const useCaseSpy = jest.spyOn(useCase, 'execute');

		const subscriber = new TestSubscriber(useCase);
		// The subscriber is never unsubscribed on eventBus because DEB is static.
		// The second subscribe does nothing. I can't reset the failed services, so this test will
		// run a check for isConnected()

		// ensure the subscriber knows the circuit is Open by running an event that will fail
		eventBus.publishEvent(getEvent('Open adds retry-Event-1'));
		await delay(100); // give it time to run

		expect(subscriber.failedServiceNames.length).toBe(1);

		jest.clearAllMocks(); // reset counters on mocks so they don't affect the test

		// Act
		eventBus.publishEvent(getEvent('Open adds retry-Event-2'));
		eventBus.publishEvent(getEvent('Open adds retry-Event-3'));
		eventBus.publishEvent(getEvent('Open adds retry-Event-4'));
		await delay(250); // give it time to run

		// Assert
		expect(useCaseSpy).toHaveBeenCalledTimes(0);
		expect(circuitBreaker.state).toBe(CircuitBreakerStateValues.Open);
		expect(circuitBreaker.retryEventCount).toBe(4); // 4 because the first event the set up the subscriber retries too
		expect(subscriber.failedServiceNames.length).toBe(1);

		// Cleanup
		eventBus.clearHandlers();

		circuitBreaker.halt();
		abortController.abort();
		await delay(100); // give anything running time to stop
	});

	test('when events are awaiting retry and the circuit moves out of Open, it runs the events', async () => {
		// Arrange
		const abortController = new AbortController();

		const service = new TestService();
		service.setTestResult(false);
		service.setLiveness(false);

		const circuitBreaker = new CircuitBreakerWithRetry({
			isAlive: service.isAlive.bind(service),
			abortSignal: abortController.signal,
			serviceName: 'TestService',
			successToCloseCount: 2,
			failureToOpenCount: 1,
			halfOpenRetryDelayMs: 10,
			closedRetryDelayMs: 10,
			openAliveCheckDelayMs: 10,
		});
		// make circuit Open
		circuitBreaker.onFailure();
		expect(circuitBreaker.state).toBe(CircuitBreakerStateValues.Open);

		const adapter = new TestAdapter(service, circuitBreaker);

		const useCase = new TestUseCase(adapter);
		const useCaseSpy = jest.spyOn(useCase, 'execute');

		const subscriber = new TestSubscriber(useCase);

		// ensure the subscriber knows the circuit is Open by running an event that will fail
		eventBus.publishEvent(getEvent('Exit open runs events-Event-1'));
		await delay(100); // give it time to run

		expect(subscriber.failedServiceNames.length).toBe(1);

		jest.clearAllMocks(); // reset counters on mocks so they don't affect the test

		// Act

		// add 3 events that will run the test subscriber
		circuitBreaker.addRetryEvent(getEvent('Exit open runs events-Event-2'));
		circuitBreaker.addRetryEvent(getEvent('Exit open runs events-Event-3'));
		circuitBreaker.addRetryEvent(getEvent('Exit open runs events-Event-4'));

		expect(useCaseSpy).not.toHaveBeenCalled();
		expect(circuitBreaker.retryEventCount).toBe(4);

		// console.log('RESTORE CONNECTION');
		service.setTestResult(true); // test() will succeed
		service.setLiveness(true);
		await delay(250);

		expect(circuitBreaker.state).toBe(CircuitBreakerStateValues.Closed);
		expect(useCaseSpy).toHaveBeenCalledTimes(4);
		expect(subscriber.failedServiceNames.length).toBe(0);

		// Cleanup
		eventBus.clearHandlers();
		circuitBreaker.halt();
		abortController.abort();
		await delay(100);
	});

	test('when retries are running and the circuit moves to Open, it stops running retries', async () => {
		// Arrange
		const abortController = new AbortController();

		const service = new TestService();
		service.setTestResult(false);
		service.setLiveness(false);

		const circuitBreaker = new CircuitBreakerWithRetry({
			isAlive: service.isAlive.bind(service),
			abortSignal: abortController.signal,
			serviceName: 'TestService',
			successToCloseCount: 2,
			failureToOpenCount: 1,
			halfOpenRetryDelayMs: 50,
			closedRetryDelayMs: 50,
			openAliveCheckDelayMs: 10,
		});
		// make circuit Open
		circuitBreaker.onFailure();
		expect(circuitBreaker.state).toBe(CircuitBreakerStateValues.Open);

		const adapter = new TestAdapter(service, circuitBreaker);

		const useCase = new TestUseCase(adapter);
		const useCaseSpy = jest.spyOn(useCase, 'execute');

		const subscriber = new TestSubscriber(useCase);

		// ensure the subscriber knows the circuit is Open by running an event that will fail
		eventBus.publishEvent(getEvent('Return to open stops retries-Event-1'));
		await delay(250); // give it time to run

		expect(subscriber.failedServiceNames.length).toBe(1);

		jest.clearAllMocks(); // reset counters on mocks so they don't affect the test

		// Act

		// add 3 events that will run the test subscriber
		circuitBreaker.addRetryEvent(getEvent('Return to open stops retries-Event-2'));
		circuitBreaker.addRetryEvent(getEvent('Return to open stops retries-Event-3'));
		circuitBreaker.addRetryEvent(getEvent('Return to open stops retries-Event-4'));

		expect(useCaseSpy).not.toHaveBeenCalled();
		expect(circuitBreaker.retryEventCount).toBe(4);

		if (VERBOSE_LOGS) console.log('RESTORING CONNECTION');
		service.setTestResult(true); // test() will succeed
		service.setLiveness(true);
		await delay(100); // should let about two events run
		service.setLiveness(false);
		service.setTestResult(false);
		if (VERBOSE_LOGS) console.log('FAILED CONNECTION');
		await delay(250);

		expect(circuitBreaker.state).toBe(CircuitBreakerStateValues.Open);
		expect(useCaseSpy).toHaveBeenCalledTimes(3); // 2 ok, 1 failure
		expect(circuitBreaker.retryEventCount).toBe(2);
		const retrySum = (
			(await circuitBreaker.getStatusAsync()).retryEvents).reduce((prev, curr) => prev + curr.retryCount , 0);
		expect(retrySum).toBeLessThanOrEqual(2); // proves retries stopped

		if (VERBOSE_LOGS) console.log('Return to open stops retries', await circuitBreaker.getStatusAsync());

		// Cleanup
		eventBus.clearHandlers();
		circuitBreaker.halt();
		abortController.abort();
		await delay(100);
	});

	test('when events are awaiting retry and the circuit is Open and onSuccess() is called, it runs the events', async () => {
		// Arrange
		const abortController = new AbortController();

		const service = new TestService();
		service.setTestResult(true);
		service.setLiveness(true);

		const circuitBreaker = new CircuitBreakerWithRetry({
			isAlive: service.isAlive.bind(service),
			abortSignal: abortController.signal,
			serviceName: 'TestService',
			successToCloseCount: 10,
			failureToOpenCount: 1,
			halfOpenRetryDelayMs: 10,
			closedRetryDelayMs: 10,
			openAliveCheckDelayMs: 10,
		});

		const adapter = new TestAdapter(service, circuitBreaker);

		const useCase = new TestUseCase(adapter);
		const useCaseSpy = jest.spyOn(useCase, 'execute');

		const subscriber = new TestSubscriber(useCase);

		// Act
		circuitBreaker.onFailure(); // force CB to Open
		expect(circuitBreaker.state).toBe(CircuitBreakerStateValues.Open);

		// add 3 events that will run the test subscriber
		circuitBreaker.addRetryEvent(getEvent('onSuccess() runs events-Event-1'));
		circuitBreaker.addRetryEvent(getEvent('onSuccess() runs events-Event-2'));
		circuitBreaker.addRetryEvent(getEvent('onSuccess() runs events-Event-3'));

		expect(useCaseSpy).not.toHaveBeenCalled();
		expect(circuitBreaker.retryEventCount).toBe(3);

		// onSuccess() should run retry events
		circuitBreaker.onSuccess();
		await delay(100);

		expect(circuitBreaker.state).toBe(CircuitBreakerStateValues.HalfOpen);
		expect(useCaseSpy).toHaveBeenCalledTimes(3);
		expect(subscriber.failedServiceNames.length).toBe(0);
		expect(circuitBreaker.retryEventCount).toBe(0);

		// Cleanup
		eventBus.clearHandlers();
		circuitBreaker.halt();
		abortController.abort();
		await delay(100);
	});
});
