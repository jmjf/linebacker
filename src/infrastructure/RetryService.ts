import { DomainEventBus, IDomainEvent } from '../common/domain/DomainEventBus';
import { delay } from '../common/utils/utils';

const RetryServiceStateValues = {
	Started: 'Started',
	Halted: 'Halted',
};

type RetryServiceStateType = typeof RetryServiceStateValues[keyof typeof RetryServiceStateValues];

export class RetryService {
	private _retryEvents: IDomainEvent[] = [];
	private _state: RetryServiceStateType = RetryServiceStateValues.Halted;
	private _delayMs: number;
	private _abortSignal: AbortSignal;

	constructor(abortSignal: AbortSignal, delayMs = 250) {
		this._abortSignal = abortSignal;
		this._delayMs = delayMs;
	}

	public get state(): RetryServiceStateType {
		return this._state;
	}

	public get retryEventIds() {
		return this._retryEvents.map((ev) => ev.getAggregateId().value);
	}

	public get retryEventCount() {
		return this._retryEvents.length;
	}

	public set delayMs(delayMs: number) {
		this._delayMs = delayMs;
	}

	public startRetries() {
		this._state = RetryServiceStateValues.Started;
	}

	public stopRetries() {
		this._state = RetryServiceStateValues.Halted;
	}

	public addRetry(ev: IDomainEvent): void {
		// only add when ev doesn't already exist in retry array
		if (
			!this._retryEvents.find(
				(retry) =>
					retry.constructor.name === ev.constructor.name &&
					retry.getAggregateId().value === ev.getAggregateId().value
			)
		) {
			this._retryEvents.push(ev);
		}
	}

	public async runRetries() {
		// if called, assume it should run; proxy if another state needs to be checked first (in circuit breaker)
		this._state = RetryServiceStateValues.Started;

		let ev: IDomainEvent | undefined;
		// Array.prototype.shift() removes the first element from the array and returns it (or undefined if none)
		while (typeof (ev = this._retryEvents.shift()) !== 'undefined') {
			DomainEventBus.publishToSubscribers(ev);

			if ((await delay(this._delayMs, this._abortSignal)) === 'AbortError') {
				this.stopRetries();
				// console.log('runRetries halting', ev.getAggregateId());
				return;
			}

			// If Halted stop
			if (this._state === RetryServiceStateValues.Halted) return;
		}
	}
}
