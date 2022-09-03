import { Result, ok, err } from '../common/core/Result';
import { BaseError } from '../common/core/BaseError';

import { DomainEventBus, IDomainEvent, IDomainEventSubscriber } from '../common/domain/DomainEventBus';
import { UniqueIdentifier } from '../common/domain/UniqueIdentifier';

import { UseCase } from '../common/application/UseCase';

import * as AdapterErrors from '../common/adapter/AdapterErrors';

import { CircuitBreakerStateValues, CircuitBreakerWithRetry, ConnectFailureErrorData } from './CircuitBreakerWithRetry';
import { delay } from './utils';

class TestService {
	private liveness: boolean;
	private testResult: boolean;

	public setLiveness(value: boolean) {
		this.liveness = value;
	}

	public setTestResult(value: boolean) {
		this.testResult = value;
	}

	async test(): Promise<Result<boolean, BaseError>> {
		return this.testResult
			? Promise.resolve(ok(true))
			: Promise.resolve(err(new AdapterErrors.BackupJobServiceError('test failed')));
	}

	async isAlive(): Promise<Result<boolean, BaseError>> {
		return this.liveness
			? Promise.resolve(ok(true))
			: Promise.resolve(err(new AdapterErrors.BackupJobServiceError('isAliveFalse')));
	}
}

class TestAdapter {
	private service: TestService;
	private circuitBreaker: CircuitBreakerWithRetry;
	private connectFailureErrorData: ConnectFailureErrorData;

	constructor(service: TestService, circuitBreaker: CircuitBreakerWithRetry) {
		this.service = service;
		this.circuitBreaker = circuitBreaker;
		this.connectFailureErrorData = {
			isConnectFailure: true,
			isConnected: this.circuitBreaker.isConnected.bind(this.circuitBreaker),
			addRetryEvent: this.circuitBreaker.addRetryEvent.bind(this.circuitBreaker),
			serviceName: this.service.constructor.name,
		};
	}

	async test(): Promise<Result<boolean, BaseError>> {
		if (this.circuitBreaker.cbState === CircuitBreakerStateValues.Open) {
			return err(new AdapterErrors.BackupJobServiceError('fast fail', this.connectFailureErrorData));
		}
		const result = await this.service.test();
		if (result.isOk()) {
			this.circuitBreaker.onSuccess();
			return ok(result.value);
		}
		// else error
		this.circuitBreaker.onFailure();
		return err(new AdapterErrors.BackupJobServiceError('connect failure', this.connectFailureErrorData));
	}
}

interface TestUseCaseDTO {
	id: UniqueIdentifier;
}

class TestUseCase implements UseCase<TestUseCaseDTO, Result<boolean, BaseError>> {
	private testAdapter: TestAdapter;

	constructor(testAdapter: TestAdapter) {
		this.testAdapter = testAdapter;
	}

	public async execute(request: TestUseCaseDTO): Promise<Result<boolean, BaseError>> {
		return await this.testAdapter.test();
	}
}

class TestEvent implements IDomainEvent {
	public eventTimestamp: Date;
	public id: UniqueIdentifier;
	public retryCount: number;

	constructor(id: UniqueIdentifier) {
		this.eventTimestamp = new Date();
		this.id = id;
	}

	getAggregateId(): UniqueIdentifier {
		return this.id;
	}
}

class TestSubscriber implements IDomainEventSubscriber<TestEvent> {
	private useCase: TestUseCase;

	constructor(useCase: TestUseCase) {
		this.setupSubscriptions();
		this.useCase = useCase;
	}

	setupSubscriptions(): void {
		DomainEventBus.subscribe(TestEvent.name, this.onEvent.bind(this));
	}

	async onEvent(event: TestEvent): Promise<void> {
		const id = event.getAggregateId();
		const eventName = event.constructor.name;

		try {
			const result = await this.useCase.execute({ id });

			if (result.isErr()) {
				console.log('subscriber use case error', result.error);
			} else {
				console.log('subscriber use case ok');
			}
		} catch (e) {
			const { message, ...error } = e as BaseError;
			console.log('subscriber error', message, error);
		}
	}
}

describe('CircuitBreakerWithRetry', () => {
	test('when the service returns a connect failure, the circuit becomes open', async () => {
		// Arrange
		const service = new TestService();
		service.setTestResult(false); // test() will fail

		const circuitBreaker = new CircuitBreakerWithRetry({
			isAlive: service.isAlive,
			successToCloseCount: 10,
			failureToOpenCount: 1,
			halfOpenRetryDelayMs: 5,
			closedRetryDelayMs: 5,
			openAliveCheckDelayMs: 2000,
		});

		const adapter = new TestAdapter(service, circuitBreaker);

		// Act
		expect(circuitBreaker.cbState).toBe(CircuitBreakerStateValues.Closed);
		const result = await adapter.test();

		// Assert
		expect(circuitBreaker.cbState).toBe(CircuitBreakerStateValues.Open);
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			// proves it doesn't fast fail
			expect(result.error.message).toContain('connect failure');
			expect((result.error.errorData as any).isConnectFailure).toBe(true);
			expect((result.error.errorData as any).isConnected()).toBe(false);
		}
	});

	test('when the circuit is open, the adapter can fail fast', async () => {
		// Arrange
		const service = new TestService();
		service.setTestResult(false); // test() will fail

		const circuitBreaker = new CircuitBreakerWithRetry({
			isAlive: service.isAlive,
			successToCloseCount: 10,
			failureToOpenCount: 1,
			halfOpenRetryDelayMs: 5,
			closedRetryDelayMs: 5,
			openAliveCheckDelayMs: 2000,
		});

		const adapter = new TestAdapter(service, circuitBreaker);

		// Act
		expect(circuitBreaker.cbState).toBe(CircuitBreakerStateValues.Closed);
		const result1 = await adapter.test();

		const result = await adapter.test();

		// Assert
		expect(circuitBreaker.cbState).toBe(CircuitBreakerStateValues.Open);
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
	});

	test('when the circuit is open, it retries the connection until the connection is restored then moves to half open', async () => {
		// Arrange
		const service = new TestService();
		service.setTestResult(false); // test() will fail

		const circuitBreaker = new CircuitBreakerWithRetry({
			isAlive: service.isAlive,
			successToCloseCount: 10,
			failureToOpenCount: 1,
			halfOpenRetryDelayMs: 5,
			closedRetryDelayMs: 5,
			openAliveCheckDelayMs: 5,
		});

		const adapter = new TestAdapter(service, circuitBreaker);

		// Act
		expect(circuitBreaker.cbState).toBe(CircuitBreakerStateValues.Closed);
		const result = await adapter.test();

		// Assert
		expect(circuitBreaker.cbState).toBe(CircuitBreakerStateValues.Open);
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect((result.error.errorData as any).isConnectFailure).toBe(true);
			expect((result.error.errorData as any).isConnected()).toBe(false);
		}

		// for first time testing, I added a console.log() in awaitIsAlive()
		// so I could see it running; after a few loops, set alive and give it
		// a few ms to see the change
		await delay(20);
		service.setLiveness(true);
		await delay(20);

		expect(circuitBreaker.cbState).toBe(CircuitBreakerStateValues.HalfOpen);
		if (result.isErr()) {
			// Half open should be give connected
			expect((result.error.errorData as any).isConnected()).toBe(true);
		}
	});

	test('when the circuit is half open and successful calls reaches the threshold, it moves to closed', async () => {
		// Arrange
		const service = new TestService();
		service.setTestResult(false); // test() will fail

		const circuitBreaker = new CircuitBreakerWithRetry({
			isAlive: service.isAlive,
			successToCloseCount: 2,
			failureToOpenCount: 1,
			halfOpenRetryDelayMs: 5,
			closedRetryDelayMs: 5,
			openAliveCheckDelayMs: 5,
		});

		const adapter = new TestAdapter(service, circuitBreaker);

		// Act
		expect(circuitBreaker.cbState).toBe(CircuitBreakerStateValues.Closed);
		const result = await adapter.test();

		// Assert
		expect(circuitBreaker.cbState).toBe(CircuitBreakerStateValues.Open);
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect((result.error.errorData as any).isConnectFailure).toBe(true);
			expect((result.error.errorData as any).isConnected()).toBe(false);
		}

		// for first time testing, I added a console.log() in awaitIsAlive()
		// so I could see it running; after a few loops, set alive and give it
		// a few ms to see the change
		await delay(20);
		service.setLiveness(true);
		await delay(20);

		expect(circuitBreaker.cbState).toBe(CircuitBreakerStateValues.HalfOpen);
		if (result.isErr()) {
			// Half open should be give connected
			expect((result.error.errorData as any).isConnected()).toBe(true);
		}

		service.setTestResult(true); // test() will succeed

		// threshold requires 2 success to close the circuit, so half open still
		const result1 = await adapter.test();
		expect(result1.isOk()).toBe(true);
		expect(circuitBreaker.cbState).toBe(CircuitBreakerStateValues.HalfOpen);

		// second success, so open now
		const result2 = await adapter.test();
		expect(result2.isOk()).toBe(true);
		expect(circuitBreaker.cbState).toBe(CircuitBreakerStateValues.Closed);
	});
});
