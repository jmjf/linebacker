import { logger } from '../../infrastructure/logging/pinoLogger';

import { Entity } from './Entity';
import { DomainEventBus, IDomainEvent } from './DomainEventBus';
import { UniqueIdentifier } from './UniqueIdentifier';

export abstract class AggregateRoot<T> extends Entity<T> {
	private _domainEvents: IDomainEvent[] = [];

	get idValue(): string {
		return this._id.value;
	}
	get id(): UniqueIdentifier {
		return this._id;
	}

	get domainEvents(): IDomainEvent[] {
		return this._domainEvents;
	}

	protected addDomainEvent(domainEvent: IDomainEvent): void {
		this._domainEvents.push(domainEvent);
		DomainEventBus.markAggregateForPublish(this);
		this.logDomainEventAdded(domainEvent);
	}

	public clearEvents(): void {
		this._domainEvents = [];
	}

	private logDomainEventAdded(domainEvent: IDomainEvent): void {
		const aggregateClass = Reflect.getPrototypeOf(this);
		const aggregateName = aggregateClass ? aggregateClass.constructor.name : 'unknown aggregate';
		const domainEventClass = Reflect.getPrototypeOf(domainEvent);
		const domainEventName = domainEventClass ? domainEventClass.constructor.name : 'unknown event';

		logger.debug({
			eventName: domainEventName,
			aggregateName: `${aggregateName}`,
			aggregateId: domainEvent.getAggregateId().value,
			msg: 'added event',
		});
	}
}
