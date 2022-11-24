import { Result } from '../../core/Result';
import * as InfrastructureErrors from '../InfrastructureErrors';

export interface IEventBusEventData {
	connectFailureCount: number;
	retryCount: number;
	eventType: string;
	event: unknown;
}

export interface IEventBusEvent {
	get eventKey(): string;
	get eventData(): IEventBusEventData;
	get eventDataString(): string;
	get event(): unknown;
	get topicName(): string;
	get eventTimestamp(): Date;
	get retryCount(): number;
	incrementRetryCount(): void;
}

export interface IEventBusSubscriber<IEventBusEvent> {
	setupSubscriptions(): void;
}

export type EventBusHandler = (event: IEventBusEvent) => void;

export interface IEventBus {
	publishEventsBulk(events: IEventBusEvent[]): Promise<Result<IEventBusEvent[], InfrastructureErrors.EventBusError>>;
	publishEvent(event: IEventBusEvent): Promise<Result<IEventBusEvent, InfrastructureErrors.EventBusError>>;
	subscribe(eventName: string, handler: EventBusHandler): void;
	clearHandlers(): void;
}
