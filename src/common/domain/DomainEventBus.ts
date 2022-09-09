import { Dictionary } from '../../utils/utils';
import { logger } from '../../infrastructure/pinoLogger';
import { AggregateRoot } from './AggregateRoot';
import { UniqueIdentifier } from './UniqueIdentifier';

export interface IDomainEvent {
	eventTimestamp: Date;
	// retryCount: number;
	getAggregateId(): UniqueIdentifier;
}

export interface IDomainEventSubscriber<IDomainEvent> {
	setupSubscriptions(): void;
}

export class DomainEventBus {
	private static handlersMap: Dictionary = {};
	private static markedAggregates: AggregateRoot<unknown>[] = [];

	public static markAggregateForPublish(aggregate: AggregateRoot<unknown>): void {
		const aggregateFound = !!this.findMarkedAggregateById(aggregate.id);

		if (!aggregateFound) {
			this.markedAggregates.push(aggregate);
		}
	}

	private static removeMarkedAggregate(aggregate: AggregateRoot<unknown>): void {
		const index = this.markedAggregates.findIndex((a) => a.equals(aggregate));
		if (index >= 0) {
			// remove if found
			this.markedAggregates.splice(index, 1);
		}
	}

	private static findMarkedAggregateById(id: UniqueIdentifier): AggregateRoot<unknown> | null {
		const found = this.markedAggregates.find((a) => a.id.value === id.value);
		return found === undefined ? null : found;
	}

	public static publishEventsForAggregate(id: UniqueIdentifier): void {
		const aggregate = this.findMarkedAggregateById(id);

		if (aggregate) {
			aggregate.domainEvents.forEach((event: IDomainEvent) => this.publishToSubscribers(event));
			aggregate.clearEvents();
			this.removeMarkedAggregate(aggregate);
		}
	}

	public static subscribe(eventName: string, handler: (event: IDomainEvent) => void): void {
		if (!Object.prototype.hasOwnProperty.call(this.handlersMap, eventName)) {
			this.handlersMap[eventName] = [];
		}
		this.handlersMap[eventName].push(handler);
	}

	public static clearHandlers(): void {
		this.handlersMap = {};
	}

	public static clearMarkedAggregates(): void {
		this.markedAggregates = [];
	}

	public static publishToSubscribers(event: IDomainEvent): void {
		const eventName: string = event.constructor.name;

		if (Object.prototype.hasOwnProperty.call(this.handlersMap, eventName)) {
			this.handlersMap[eventName].forEach((handler: (event: IDomainEvent) => void) => {
				logger.debug({ eventName, handerName: handler.name }, 'publish event');
				handler(event);
			});
		}
	}
}
