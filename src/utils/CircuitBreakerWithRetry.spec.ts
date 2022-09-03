import { Result, ok, err } from '../common/core/Result';
import { BaseError } from '../common/core/BaseError';

import { DomainEventBus, IDomainEvent, IDomainEventSubscriber } from '../common/domain/DomainEventBus';
import { UniqueIdentifier } from '../common/domain/UniqueIdentifier';

import { UseCase } from '../common/application/UseCase';

import * as AdapterErrors from '../common/adapter/AdapterErrors';

import { CircuitBreakerStateValues, CircuitBreakerWithRetry, ConnectFailureErrorData } from './CircuitBreakerWithRetry';

class TestService {
	async test(): Promise<Result<boolean, BaseError>> {
		return ok(true);
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
	const isAliveTrue = async () => {
		return Promise.resolve(ok(true));
	};

	const isAliveFalse = async () => {
		return Promise.resolve(err(new AdapterErrors.BackupJobServiceError('isAliveFalse')));
	};

	test('when the service returns a connect failure, it becomes open', async () => {
		// Arrange
		const circuitBreaker = new CircuitBreakerWithRetry({
			isAlive: isAliveFalse,
			successToCloseCount: 10,
			failureToOpenCount: 1,
			halfOpenRetryDelayMs: 5,
			closedRetryDelayMs: 5,
			openAliveCheckDelayMs: 2000,
		});

		const service = new TestService();
		service.test = isAliveFalse; // failse

		const adapter = new TestAdapter(service, circuitBreaker);

		// Act
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
});
