import { BaseError } from './common/core/BaseError';
import { err, ok, Result } from './common/core/Result';

import * as AdapterErrors from './common/adapter/AdapterErrors';
import {
	CircuitBreakerStateValues,
	CircuitBreakerWithRetry,
	ConnectFailureErrorData,
} from './common/utils/CircuitBreakerWithRetry';
import { delay, Dictionary } from './common/utils/utils';
import { UniqueIdentifier } from './common/domain/UniqueIdentifier';
import { UseCase } from './common/application/UseCase';
import { DomainEventBus, IDomainEvent, IDomainEventSubscriber } from './common/domain/DomainEventBus';

class TestService {
	private liveness: boolean;
	private testResult: boolean;

	constructor() {
		this.liveness = true;
		this.testResult = true;
	}

	public async setLiveness(value: boolean) {
		this.liveness = value;
	}

	public setTestResult(value: boolean) {
		this.testResult = value;
	}

	public async test(): Promise<Result<boolean, BaseError>> {
		return this.testResult
			? Promise.resolve(ok(true))
			: Promise.resolve(err(new AdapterErrors.BackupJobServiceError('test failed')));
	}

	public async isAlive(): Promise<Result<boolean, BaseError>> {
		return this.liveness
			? Promise.resolve(ok(true))
			: Promise.resolve(err(new AdapterErrors.BackupJobServiceError('isAlive false')));
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
		if (!this.circuitBreaker.isConnected()) {
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
	retryCount: number;
}

class TestUseCase implements UseCase<TestUseCaseDTO, Result<boolean, BaseError>> {
	private testAdapter: TestAdapter;

	constructor(testAdapter: TestAdapter) {
		this.testAdapter = testAdapter;
	}

	public async execute(request: TestUseCaseDTO): Promise<Result<boolean, BaseError>> {
		console.log('TestUseCase request', request);
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
		this.retryCount = 0;
	}

	getAggregateId(): UniqueIdentifier {
		return this.id;
	}
}

class TestSubscriber implements IDomainEventSubscriber<TestEvent> {
	private useCase: TestUseCase;
	private failedServices: Dictionary = {};

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

		console.log('subscriber event', id.value, event.retryCount);

		if (Object.keys(this.failedServices).length > 0) {
			console.log('failedServices', Object.keys(this.failedServices));
			// have connection checks
			for (const serviceName in this.failedServices) {
				console.log('subscriber connection check for', serviceName, this.failedServices[serviceName].isConnected());
				if (!this.failedServices[serviceName].isConnected()) {
					event.retryCount++;
					this.failedServices[serviceName].addRetryEvent(event);
					console.log('subscriber connection check add retry', id.value, event.retryCount);
					return; // something is down so no need to check further
				}

				// if it doesn't fail, don't need to check again
				delete this.failedServices[serviceName];
			}
		}
		try {
			const result = await this.useCase.execute({ id, retryCount: event.retryCount });

			if (result.isErr()) {
				console.log('subscriber use case error', event.id.value, event.retryCount, result.error);
				const errorData = result.error.errorData as any;
				if (errorData.isConnectFailure) {
					if (errorData.serviceName && errorData.isConnected && !this.failedServices[errorData.serviceName]) {
						console.log('subscriber add connection check for', errorData.serviceName);
						this.failedServices[errorData.serviceName] = { isConnected: undefined, addRetryEvent: undefined };
						this.failedServices[errorData.serviceName].isConnected = errorData.isConnected;
						this.failedServices[errorData.serviceName].addRetryEvent = errorData.addRetryEvent;
					}
					if (errorData.addRetryEvent) {
						event.retryCount++;
						errorData.addRetryEvent(event);
						console.log('subscriber add retry', id.value, event.retryCount);
					}
				}
			} else {
				console.log('subscriber use case ok', event.id.value, event.retryCount);
			}
		} catch (e) {
			const { message, ...error } = e as BaseError;
			console.log('subscriber error', message, error);
		}
	}
}

function getEvent() {
	return new TestEvent(new UniqueIdentifier());
}

async function main() {
	const service = new TestService();
	service.setTestResult(false);
	service.setLiveness(false);

	const ac = new AbortController();

	const circuitBreaker = new CircuitBreakerWithRetry({
		isAlive: service.isAlive.bind(service),
		abortSignal: ac.signal,
		successToCloseCount: 2,
		failureToOpenCount: 1,
		halfOpenRetryDelayMs: 10,
		closedRetryDelayMs: 10,
		openAliveCheckDelayMs: 10,
	});
	// make circuit Open
	circuitBreaker.onFailure();
	//expect(circuitBreaker.cbState).toBe(CircuitBreakerStateValues.Open);

	const adapter = new TestAdapter(service, circuitBreaker);

	const useCase = new TestUseCase(adapter);
	//const useCaseSpy = jest.spyOn(useCase, 'execute');

	const subscriber = new TestSubscriber(useCase);
	// ensure the subscriber knows the circuit is Open by running an event that will fail
	DomainEventBus.publishToSubscribers(getEvent());
	await delay(100); // give it time to run
	//jest.clearAllMocks(); // reset counters on mocks so they don't affect the test

	// Act

	// add 3 events that will run the test subscriber
	circuitBreaker.addRetryEvent(getEvent());
	circuitBreaker.addRetryEvent(getEvent());
	circuitBreaker.addRetryEvent(getEvent());

	await delay(250);
	service.setTestResult(true); // test() will succeed
	service.setLiveness(true);
	await delay(1000);

	//expect(circuitBreaker.cbState).toBe(CircuitBreakerStateValues.Closed);
	//expect(useCaseSpy).toHaveBeenCalledTimes(4);
	//console.log('useCaseSpy 1', JSON.stringify(useCaseSpy.mock.calls, null, 3));

	service.setTestResult(true); // test() will succeed
	service.setLiveness(true);
	await delay(500);
}

main();
