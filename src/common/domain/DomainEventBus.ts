import { AggregateRoot } from './AggregateRoot';
import { UniqueIdentifier } from './UniqueIdentifier';

export interface IDomainEvent {
   eventTimestamp: Date;
   getAggregateId (): UniqueIdentifier;
}

export interface IDomainEventHandler<IDomainEvent> {
   setupSubscriptions(): void;
}

export class DomainEventBus {
   private static handlersMap: {[index: string]:any} = {};
   private static markedAggregates: AggregateRoot<any>[] = [];

   public static markAggregateForPublish(aggregate: AggregateRoot<any>): void {
      const aggregateFound = !!this.findMarkedAggregateById(aggregate.id);

      if (!aggregateFound) {
         this.markedAggregates.push(aggregate);
      }
   }

   private static publishAggregateEvents(aggregate: AggregateRoot<any>): void {
      aggregate.domainEvents.forEach((event: IDomainEvent) => this.publishToSubscribers(event));
   }

   private static removeMarkedAggregate(aggregate: AggregateRoot<any>): void {
      const index = this.markedAggregates.findIndex((a) => a.equals(aggregate));
      if (index >= 0) { 
         // remove if found
         this.markedAggregates.splice(index, 1);
      }
   }

   private static findMarkedAggregateById(id: UniqueIdentifier): AggregateRoot<any> | null{
      const found = this.markedAggregates.find((a) => a.id.value === id.value);
      return (found === undefined) ? null : found;
   }

   public static publishEventsForAggregate(id: UniqueIdentifier): void {
      const aggregate = this.findMarkedAggregateById(id);

      if (aggregate) {
         this.publishAggregateEvents(aggregate);
         aggregate.clearEvents();
         this.removeMarkedAggregate(aggregate);
      }
   }

   public static subscribe(eventName: string, handler: (event: IDomainEvent) => void): void {
      if(!Object.prototype.hasOwnProperty.call(this.handlersMap, eventName)) {
         this.handlersMap[eventName] = [];
      }
      this.handlersMap[eventName].push(handler);
   }

   public static clearHandlers(): void {
      this.handlersMap = [];
   }

   public static clearMarkedAggregates(): void {
      this.markedAggregates = [];
   }

   private static publishToSubscribers(event: IDomainEvent): void {
      const eventName: string = event.constructor.name;

      if (Object.prototype.hasOwnProperty.call(this.handlersMap, eventName)) {
         this.handlersMap[eventName].forEach((handler: ((event: IDomainEvent) => void)) => handler(event));
      }
   }
}