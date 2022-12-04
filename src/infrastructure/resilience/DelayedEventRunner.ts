import { eventBus } from '../../common/infrastructure/event-bus/eventBus';
import { EventBusEvent } from '../../common/infrastructure/event-bus/IEventBus';
import { delay } from '../../common/utils/utils';

const DelayedEventRunnerStateValues = {
	Run: 'Run', // retryEvents() running
	Stop: 'Stop', // retryEvents() finished or paused
	Halt: 'Halt', // abort signal received, shutting down
};

type DelayedEventRunnerStateType = typeof DelayedEventRunnerStateValues[keyof typeof DelayedEventRunnerStateValues];

export class DelayedEventRunner {
	private _events: EventBusEvent<any>[] = [];
	private _state: DelayedEventRunnerStateType = DelayedEventRunnerStateValues.Stop;
	private _delayMs: number;
	private _abortSignal: AbortSignal;

	constructor(abortSignal: AbortSignal, delayMs = 250) {
		this._abortSignal = abortSignal;
		this._delayMs = delayMs;
	}

	public get eventIds() {
		return this._events.map((ev) => ev.eventKey);
	}

	public get events() {
		return this._events.map((ev) => {
			return ev;
		});
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

	public isStateStop(): boolean {
		return this._state === DelayedEventRunnerStateValues.Stop;
	}

	public setStateRun() {
		this._state = DelayedEventRunnerStateValues.Run;
	}

	public setStateHalt() {
		this._state = DelayedEventRunnerStateValues.Halt;
	}

	public setStateStop() {
		this._state = DelayedEventRunnerStateValues.Stop;
	}

	public addEvent(ev: EventBusEvent<unknown>): void {
		if (this.isStateHalt()) return;

		// only add when ev doesn't already exist in event array
		// console.log('DER addEvent', ev);
		if (
			this._events.find(
				(arrEvent) =>
					arrEvent.constructor.name === ev.constructor.name &&
					(ev.eventKey === undefined || arrEvent.eventKey === ev.eventKey)
			) === undefined
		) {
			// console.log('DER adding', ev);
			this._events.push(ev);
		}
	}

	public clearEvents() {
		this._events = [];
	}

	public async runEvents() {
		// do not start if no events or not stopped (already running or halted)
		if (this.eventCount <= 0 || !this.isStateStop()) return;

		// console.log('DER run events', this.events);
		this.setStateRun();

		let ev: EventBusEvent<unknown> | undefined;
		// Array.prototype.shift() removes the first element from the array and returns it or undefined if none
		// order of this condition is important to ensure we don't shift events off the array if we're stopping
		while (this.isStateRun() && typeof (ev = this._events.shift()) !== 'undefined') {
			// console.log('DER publish', ev, this.events);
			eventBus.publishEvent(ev);

			if ((await delay(this._delayMs, this._abortSignal)) === 'AbortError') {
				this.setStateHalt();
				// console.log('runEvents halting', ev.getId());
				return;
			}
		}
		// console.log('runEvents stopping');
		// either finished or stopped by owner object
		this.setStateStop();
	}
}
