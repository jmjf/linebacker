import { DomainEventBus, IDomainEvent } from '../common/domain/DomainEventBus';
import { delay } from '../common/utils/utils';

const DelayedEventRunnerStateValues = {
	Run: 'Run',
	Halt: 'Halt',
};

type DelayedEventRunnerStateType = typeof DelayedEventRunnerStateValues[keyof typeof DelayedEventRunnerStateValues];

export class DelayedEventRunner {
	private _events: IDomainEvent[] = [];
	private _state: DelayedEventRunnerStateType = DelayedEventRunnerStateValues.Halt;
	private _delayMs: number;
	private _abortSignal: AbortSignal;

	constructor(abortSignal: AbortSignal, delayMs = 250) {
		this._abortSignal = abortSignal;
		this._delayMs = delayMs;
	}

	public get eventIds() {
		return this._events.map((ev) => ev.getAggregateId().value);
	}

	public get eventCount() {
		return this._events.length;
	}

	public set delayMs(delayMs: number) {
		this._delayMs = delayMs;
	}

	public isStateRun(): boolean {
		return this._state === DelayedEventRunnerStateValues.Run;
	}

	public isStateHalt(): boolean {
		return this._state === DelayedEventRunnerStateValues.Halt;
	}

	public setStateRun() {
		this._state = DelayedEventRunnerStateValues.Run;
	}

	public setStateHalt() {
		this._state = DelayedEventRunnerStateValues.Halt;
	}

	public addEvent(ev: IDomainEvent): void {
		// only add when ev doesn't already exist in event array
		if (
			this._events.find(
				(arrEvent) =>
					arrEvent.constructor.name === ev.constructor.name &&
					arrEvent.getAggregateId().value === ev.getAggregateId().value
			) === undefined
		) {
			this._events.push(ev);
		}
	}

	public async runEvents() {
		// if called, assume it should run; in circuit breaker check for Halted before calling
		this._state = DelayedEventRunnerStateValues.Run;

		let ev: IDomainEvent | undefined;
		// Array.prototype.shift() removes the first element from the array and returns it (or undefined if none)
		while (typeof (ev = this._events.shift()) !== 'undefined') {
			DomainEventBus.publishToSubscribers(ev);

			if ((await delay(this._delayMs, this._abortSignal)) === 'AbortError') {
				this.setStateHalt();
				// console.log('runEvents halting', ev.getAggregateId());
				return;
			}

			// If Halted stop
			if (this._state === DelayedEventRunnerStateValues.Halt) return;
		}
	}
}
