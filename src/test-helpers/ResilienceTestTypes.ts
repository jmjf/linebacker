import { BaseError } from '../common/core/BaseError';
import { err, ok, Result } from '../common/core/Result';
import { UniqueIdentifier } from '../common/domain/UniqueIdentifier';
import { UseCase } from '../common/application/UseCase';
import * as AdapterErrors from '../common/adapter/AdapterErrors';
import { EventBusEvent, IEventBusSubscriber } from '../common/infrastructure/event-bus/IEventBus';
import { eventBus } from '../common/infrastructure/event-bus/eventBus';

import { CircuitBreakerWithRetry, ConnectFailureErrorData } from '../infrastructure/resilience/CircuitBreakerWithRetry';

const VERBOSE_LOGS = false;

export class TestService {
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

export class TestAdapter {
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



export interface TestUseCaseDTO {
	id: string;
	retryCount: number;
}

export class TestUseCase implements UseCase<TestUseCaseDTO, Result<boolean, BaseError>> {
	private testAdapter: TestAdapter;

	constructor(testAdapter: TestAdapter) {
		this.testAdapter = testAdapter;
	}

	public async execute(request: TestUseCaseDTO): Promise<Result<boolean, BaseError>> {
		if (VERBOSE_LOGS) console.log('TestUseCase request', request);
		return await this.testAdapter.test();
	}
}

export interface TestEventData {
	event: {
		id: UniqueIdentifier;
	}
}

export class TestEvent extends EventBusEvent<TestEventData> {
	
	constructor(id: UniqueIdentifier) {
		super();
		this._eventData = {
			retryCount: 0,
			connectFailureCount: 0,
			eventType: 'TestEvent',
			event: {
				id: id
			}
		};
		this._eventKey = id.value;
	}
}

export class TestSubscriber implements IEventBusSubscriber<TestEvent> {
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