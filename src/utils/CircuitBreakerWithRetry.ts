import { BaseError } from '../common/core/BaseError';
import { Result } from '../common/core/Result';
import { IDomainEvent } from '../common/domain/DomainEventBus';

export const CircuitBreakerStateValues = {
	Open: 'Open', // no connection
	HalfOpen: 'HalfOpen', // connection, but may not be reliable
	Closed: 'Closed', // connection considered reliable
	// Think of a switch in an electrical circuit.
	// If the switch is closed, electricity flows.
	// If the switch is open, there's a hole in the wire and nothing flows.
};

type CircuitBreakerStateType = typeof CircuitBreakerStateValues[keyof typeof CircuitBreakerStateValues];

export interface CircuitBreakerOpts {
	isAlive: () => Promise<Result<boolean, BaseError>>;
	successToCloseCount?: number;
	failureToOpenCount?: number;
	halfOpenRetryDelayMs?: number;
	closedRetryDelayMs?: number;
	openAliveCheckDelayMs?: number;
}

export interface ConnectFailureErrorData {
	isConnectFailure: boolean;
	isConnected: () => boolean;
	addRetryEvent: (ev: IDomainEvent) => void;
	serviceName: string;
}

export class CircuitBreakerWithRetry {
	private state: CircuitBreakerStateType;
	private successCount: number;
	private failureCount: number;
	private successToCloseCount: number;
	private failureToOpenCount: number;
	private halfOpenRetryDelayMs: number;
	private closedRetryDelayMs: number;
	private openAliveCheckDelayMs: number;
	private isAlive: () => Promise<Result<boolean, BaseError>>;
	private retryEvents: IDomainEvent[];

	constructor(opts: CircuitBreakerOpts) {
		this.state = CircuitBreakerStateValues.Closed;
		this.successCount = 0;
		this.failureCount = 0;
		this.successToCloseCount = opts.successToCloseCount || 5;
		this.failureToOpenCount = opts.failureToOpenCount || 5;
		this.halfOpenRetryDelayMs = opts.halfOpenRetryDelayMs || 500;
		this.closedRetryDelayMs = opts.closedRetryDelayMs || 100;
		this.openAliveCheckDelayMs = opts.openAliveCheckDelayMs || 30 * 1000;
		this.isAlive = opts.isAlive;
	}

	public get cbState(): CircuitBreakerStateType {
		return this.state;
	}

	public isConnected(): boolean {
		return this.state !== CircuitBreakerStateValues.Open;
	}

	public onSuccess() {
		return;
	}

	public onFailure() {
		if (this.state === CircuitBreakerStateValues.Closed) this.failureCount++;
		if (this.failureCount >= this.failureToOpenCount) {
			this.state = CircuitBreakerStateValues.Open;
			this.successCount = 0;
			this.awaitIsAlive();
		}
	}

	public addRetryEvent(ev: IDomainEvent) {
		return;
	}

	private runRetries() {
		return;
	}

	private async awaitIsAlive() {
		return;
	}
}
