import { BaseError } from '../../common/core/BaseError';
import { Result } from '../../common/core/Result';
import { IEventBusEvent } from '../../common/infrastructure/event-bus/IEventBus';
import { delay } from '../../common/utils/utils';
import { DelayedEventRunner } from './DelayedEventRunner';

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
	abortSignal: AbortSignal;
	serviceName: string;
	successToCloseCount?: number;
	failureToOpenCount?: number;
	halfOpenRetryDelayMs?: number;
	closedRetryDelayMs?: number;
	openAliveCheckDelayMs?: number;
}

export interface ConnectFailureErrorData {
	isConnectFailure: boolean;
	isConnected: () => boolean;
	addRetryEvent: (ev: IEventBusEvent) => void;
	serviceName: string;
}

export class CircuitBreakerWithRetry {
	private _state: CircuitBreakerStateType;
	private _abortSignal: AbortSignal;
	private _successCount: number;
	private _failureCount: number;
	private _successToCloseCount: number;
	private _failureToOpenCount: number;
	private _halfOpenRetryDelayMs: number;
	private _closedRetryDelayMs: number;
	private _openAliveCheckDelayMs: number;
	private _isAlive: () => Promise<Result<boolean, BaseError>>;
	private _serviceName: string;
	private _delayedEventRunner: DelayedEventRunner;
	private _lifetimeSuccessCount: number;
	private _lifetimeFailureCount: number;
	private _awaitIsAliveCount: number;
	private _lifetimeAwaitIsAliveCount: number;

	public halt() {
		this._state = CircuitBreakerStateValues.Halted;
		this._delayedEventRunner.clearEvents();
	}

	constructor(opts: CircuitBreakerOpts) {
		this._state = CircuitBreakerStateValues.HalfOpen;
		this._abortSignal = opts.abortSignal;
		this._successToCloseCount = opts.successToCloseCount || 5;
		this._failureToOpenCount = opts.failureToOpenCount || 5;
		this._halfOpenRetryDelayMs = opts.halfOpenRetryDelayMs || 500;
		this._closedRetryDelayMs = opts.closedRetryDelayMs || 100;
		this._openAliveCheckDelayMs = opts.openAliveCheckDelayMs || 30 * 1000;
		this._isAlive = opts.isAlive;
		this._serviceName = opts.serviceName;
		this._delayedEventRunner = new DelayedEventRunner(this._abortSignal, this._closedRetryDelayMs);
		this._successCount = 0;
		this._failureCount = 0; // zero for initial HalfOpen
		this.setStateIfAlive(CircuitBreakerStateValues.Closed); // async function that sets correct state
		this._lifetimeSuccessCount = 0;
		this._lifetimeFailureCount = 0;
		this._awaitIsAliveCount = 0;
		this._lifetimeAwaitIsAliveCount = 0;
	}

	public get state(): CircuitBreakerStateType {
		return this._state;
	}

	public get serviceName(): string {
		return this._serviceName;
	}

	public get retryEventCount(): number {
		return this._delayedEventRunner.eventCount;
	}

	public get retryEventIds() {
		return this._delayedEventRunner.eventIds;
	}

	public getStatusSync() {
		return {
			state: this._state,
			successCount: this._successCount,
			lifetimeSuccessCount: this._lifetimeSuccessCount,
			failureCount: this._failureCount,
			lifetimeFailureCount: this._lifetimeFailureCount,
			awaitIsAliveCount: this._awaitIsAliveCount,
			lifetimeAwaitIsAliveCount: this._lifetimeAwaitIsAliveCount,
			isConnected: this.isConnected(),
			retryEventCount: this.retryEventCount,
		};
	}

	public async getStatusAsync() {
		return {
			state: this._state,
			successCount: this._successCount,
			lifetimeSuccessCount: this._lifetimeSuccessCount,
			failureCount: this._failureCount,
			lifetimeFailureCount: this._lifetimeFailureCount,
			awaitIsAliveCount: this._awaitIsAliveCount,
			lifetimeAwaitIsAliveCount: this._lifetimeAwaitIsAliveCount,
			isAlive: (await this._isAlive()).isOk(),
			retryEventCount: this.retryEventCount,
			retryEvents: this._delayedEventRunner.events,
		};
	}

	public isConnected(): boolean {
		return this._state !== CircuitBreakerStateValues.Open;
	}

	public onSuccess() {
		// do nothing if halted
		if (this._state === CircuitBreakerStateValues.Halted) return;

		this._lifetimeSuccessCount++;

		// Callers that don't check for fast fail may call onSuccess and move to Half Open
		// while awaitIsAlive is waiting. awaitIsAlive will end its loop after its delay ends.

		// when Closed, success decrements failure count to 0
		if (this._state === CircuitBreakerStateValues.Closed) {
			this._failureCount = Math.max(0, this._failureCount - 1);
		} else {
			// Open or Half Open; increment successCount
			this._successCount++;

			// any successful call will move to either Closed or HalfOpen
			if (this._successCount >= this._successToCloseCount) {
				this._state = CircuitBreakerStateValues.Closed;
				this._failureCount = 0;
			} else {
				this._state = CircuitBreakerStateValues.HalfOpen;
			}

			this._delayedEventRunner.delayMs =
				this._state === CircuitBreakerStateValues.Closed ? this._closedRetryDelayMs : this._halfOpenRetryDelayMs;
		}

		// runEvents() decides if it should run again; avoids conflicts if called while it's running, keeps DER intelligence in DER
		this._delayedEventRunner.runEvents();
	}

	public onFailure() {
		// do nothing if halted
		if (this._state === CircuitBreakerStateValues.Halted) return;

		this._lifetimeFailureCount++;

		if (this._state !== CircuitBreakerStateValues.Open) this._failureCount++;

		if (this._failureCount >= this._failureToOpenCount) {
			this._state = CircuitBreakerStateValues.Open;
			this._delayedEventRunner.setStateStop();
			this._successCount = 0;
			this.awaitIsAlive();
		}
	}

	public addRetryEvent(ev: IEventBusEvent) {
		// do nothing if halted
		if (this._state === CircuitBreakerStateValues.Halted) return;

		this._delayedEventRunner.addEvent(ev);
	}

	private async setStateIfAlive(state: CircuitBreakerStateType) {
		// console.log('cbwr start, checkLiveness state', this._serviceName, this._state, this.isConnected());
		const result = await this._isAlive();
		if (result.isOk()) this._state = state;
		// console.log('cbwr end, checkLiveness state', this._serviceName, this._state, this.isConnected());
	}

	private async awaitIsAlive() {
		// do nothing if halted
		if (this._state === CircuitBreakerStateValues.Halted) return;

		while (this._state === CircuitBreakerStateValues.Open) {
			if ((await delay(this._openAliveCheckDelayMs, this._abortSignal)) === 'AbortError') {
				this.halt();
				return;
			}
			await this.setStateIfAlive(CircuitBreakerStateValues.HalfOpen);
			this._awaitIsAliveCount++;
			this._lifetimeAwaitIsAliveCount++;
		}
		this._awaitIsAliveCount = 0;
		this._delayedEventRunner.runEvents();
	}
}
