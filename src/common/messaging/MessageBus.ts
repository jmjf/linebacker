import { Message } from 'kafkajs';
import { logger } from '../../infrastructure/logging/pinoLogger';
import { AggregateRoot } from '../domain/AggregateRoot';

// Message classes implement this interface
export interface IBusMessage {
	get messageKey(): string;
	get messageData(): unknown;
	get messageDataString(): string;
	get topicName(): string;
	get messageTimestamp(): Date;
	get retryCount(): number;
	incrementRetryCount(): void;
}

// Message handlers have this type
export interface IBusMessageHandler {
	onMessage(message: Message): Promise<BusMessageHandlerResultType>;
}

// Message handlers return these values
export const BusMessageHandlerResult = {
	Retry: 'retry',
	Error: 'error',
	Ok: 'ok',
} as const;

// Message handler results have this type
export type BusMessageHandlerResultType = typeof BusMessageHandlerResult[keyof typeof BusMessageHandlerResult];

// Array of valid message handler results for checks
export const validBusMessageHandlerResultValues = Object.values(BusMessageHandlerResult);

// The rest of this is questionable

export interface IBusSubscriber<IBusMessage> {
	setupSubscriptions(): void;
}

class EventBus {
	// private handlersMap = new Map<string, MessageBusBusMessageHandler[]>();

	public publishEventsForAggregate(aggregate: AggregateRoot<unknown>): void {
		// if (aggregate) {
		// 	aggregate.domainEvents.forEach((event: IMessageBusMessage) => this.publishToSubscribers(event));
		// 	aggregate.clearEvents();
		// }
	}

	public subscribe(eventName: string, handler: IBusMessageHandler): void {
		// if (!Object.prototype.hasOwnProperty.call(this.handlersMap, eventName)) {
		// 	this.handlersMap[eventName] = [];
		// }
		// this.handlersMap[eventName].push(handler);
	}

	public clearHandlers(): void {
		// this.handlersMap = {};
	}

	public publishToSubscribers(event: IBusMessage): void {
		// const eventName: string = event.constructor.name;
		// if (Object.prototype.hasOwnProperty.call(this.handlersMap, eventName)) {
		// 	this.handlersMap[eventName].forEach((handler: (event: IDomainEvent) => void) => {
		// 		logger.trace({ eventName, handerName: handler.name }, 'publish event');
		// 		handler(event);
		// 	});
		// }
	}
}

export const eventBus = new EventBus();
