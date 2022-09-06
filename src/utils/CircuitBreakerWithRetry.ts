import { BaseError } from '../common/core/BaseError';
import { Result } from '../common/core/Result';
import { IDomainEvent, DomainEventBus } from '../common/domain/DomainEventBus';
import { delay, isTest } from './utils';

export const CircuitBreakerStateValues = {
	Open: 'Open', // no connection
	HalfOpen: 'HalfOpen', // connection, but may not be reliable
	Closed: 'Closed', // connection considered reliable
	Halted: 'Halted', // circuit breaker is dead
	// Think of a switch in an electrical circuit.
	// If the switch is closed, electricity flows.
	// If the switch is open, there's a hole in the wire and nothing flows.
};

type CircuitBreakerStateType = typeof CircuitBreakerStateValues[keyof typeof CircuitBreakerStateValues];

export interface CircuitBreakerOpts {
	isAlive: () => Promise<Result<boolean, BaseError>>;
	haltSignal: AbortSignal;
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
	private _state: CircuitBreakerStateType;
	private haltSignal: AbortSignal;
	private successCount: number;
	private failureCount: number;
	private successToCloseCount: number;
	private failureToOpenCount: number;
	private halfOpenRetryDelayMs: number;
	private closedRetryDelayMs: number;
	private openAliveCheckDelayMs: number;
	private isAlive: () => Promise<Result<boolean, BaseError>>;
	private retryEvents: IDomainEvent[] = [];

	public halt() {
		this._state = CircuitBreakerStateValues.Halted;
		this.retryEvents = [];
	}

	constructor(opts: CircuitBreakerOpts) {
		this._state = CircuitBreakerStateValues.Closed;
		this.haltSignal = opts.haltSignal;
		this.successCount = 0;
		this.failureCount = 0;
		this.successToCloseCount = opts.successToCloseCount || 5;
		this.failureToOpenCount = opts.failureToOpenCount || 5;
		this.halfOpenRetryDelayMs = opts.halfOpenRetryDelayMs || 500;
		this.closedRetryDelayMs = opts.closedRetryDelayMs || 100;
		this.openAliveCheckDelayMs = opts.openAliveCheckDelayMs || 30 * 1000;
		this.isAlive = opts.isAlive;
	}

	public get state(): CircuitBreakerStateType {
		return this._state;
	}

	public get retryEventCount(): number {
		return this.retryEvents.length;
	}

	public get retryEventIds() {
		return this.retryEvents.map((ev) => ev.getAggregateId().value);
	}

	public async getStatus() {
		return {
			state: this._state,
			successCount: this.successCount,
			failureCount: this.failureCount,
			isAlive: (await this.isAlive()).isOk(),
			retryEventCount: this.retryEventCount,
			retryEvents: this.retryEvents.map((ev) => {
				return { ...ev, id: ev.getAggregateId().value };
			}),
		};
	}

	public isConnected(): boolean {
		return this._state !== CircuitBreakerStateValues.Open;
	}

	public onSuccess() {
		// do nothing if halted
		if (this._state === CircuitBreakerStateValues.Halted) return;

		// Callers that don't check for fast fail may call onSuccess and move to Half Open
		// while awaitIsAlive is waiting. awaitIsAlive will end its loop after its delay ends.

		// when Closed, success resets any accumulated failures
		if (this._state === CircuitBreakerStateValues.Closed) {
			this.failureCount = 0;
		} else {
			// Open or Half Open; increment successCount
			this.successCount++;

			// any successful call will move to either Closed or HalfOpen
			this._state =
				this.successCount >= this.successToCloseCount
					? CircuitBreakerStateValues.Closed
					: CircuitBreakerStateValues.HalfOpen;
		}
	}

	public onFailure() {
		// do nothing if halted
		if (this._state === CircuitBreakerStateValues.Halted) return;

		if (this._state === CircuitBreakerStateValues.Closed) this.failureCount++;

		if (this.failureCount >= this.failureToOpenCount) {
			this._state = CircuitBreakerStateValues.Open;
			this.successCount = 0;
			this.awaitIsAlive();
		}
	}

	public addRetryEvent(ev: IDomainEvent) {
		// do nothing if halted
		if (this._state === CircuitBreakerStateValues.Halted) return;

		this.retryEvents.push(ev);
	}

	private async runRetries() {
		// do nothing if halted
		if (this._state === CircuitBreakerStateValues.Halted) return;

		let ev: IDomainEvent | undefined;
		// Array.prototype.shift() removes the first element from the array and returns it (or undefined if none)
		while (typeof (ev = this.retryEvents.shift()) !== 'undefined') {
			DomainEventBus.publishToSubscribers(ev);

			if (
				(await delay(
					this._state === CircuitBreakerStateValues.Closed ? this.closedRetryDelayMs : this.halfOpenRetryDelayMs,
					this.haltSignal
				)) === 'AbortError'
			) {
				this.halt();
				// console.log('runRetries halting', ev.getAggregateId());
				return;
			}

			// If the circuit goes Open or Halted stop
			if (this._state === CircuitBreakerStateValues.Open || this._state === CircuitBreakerStateValues.Halted) return;
		}
	}

	private async awaitIsAlive() {
		// do nothing if halted
		if (this._state === CircuitBreakerStateValues.Halted) return;

		while (this._state === CircuitBreakerStateValues.Open) {
			const result = await this.isAlive();
			if (result.isOk()) {
				this._state = CircuitBreakerStateValues.HalfOpen; // ends loop
			} else {
				if ((await delay(this.openAliveCheckDelayMs, this.haltSignal)) === 'AbortError') {
					this.halt();
					// console.log('awaitIsAlive halting');
					return;
				}
			}
		}

		this.runRetries();
	}
}
