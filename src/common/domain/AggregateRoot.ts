import { logger } from '../../infrastructure/logging/pinoLogger';

import { Entity } from './Entity';
import { UniqueIdentifier } from './UniqueIdentifier';
import { IEventBusEvent } from '../infrastructure/event-bus/IEventBus';

export abstract class AggregateRoot<T> extends Entity<T> {
	private _events: IEventBusEvent[] = [];

	get idValue(): string {
		return this._id.value;
	}
	get id(): UniqueIdentifier {
		return this._id;
	}

	get events(): IEventBusEvent[] {
		return this._events;
	}

	protected addEvent(event: IEventBusEvent): void {
		this._events.push(event);
		this.logEventAdded(event);
	}

	public clearEvents(): void {
		this._events = [];
	}

	private logEventAdded(event: IEventBusEvent): void {
		const aggregateClass = Reflect.getPrototypeOf(this);
		const aggregateName = aggregateClass ? aggregateClass.constructor.name : 'unknown aggregate';
		const eventClass = Reflect.getPrototypeOf(event);
		const eventName = eventClass ? eventClass.constructor.name : 'unknown event';

		logger.trace({
			aggregateName,
			eventName,
			eventKey: event.eventKey,
			eventData: event.eventData
		}, 'Added event');
	}
}
