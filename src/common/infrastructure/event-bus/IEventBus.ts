import { Result } from '../../core/Result';
import * as InfrastructureErrors from '../InfrastructureErrors';

export interface IEventBusEventData {
	connectFailureCount: number;
	retryCount: number;
	eventType: string;
	event: unknown;
}

export abstract class EventBusEvent<EventDataType> {
	protected _eventTimestamp: Date;
	protected _eventData: IEventBusEventData & EventDataType;
	protected _eventKey: string;
	protected _topicName: string;

	constructor() {
		this._eventTimestamp = new Date();
		this._topicName = 'linebacker';
	}

	get topicName() {
		return this._topicName;
	}

	get eventKey() {
		return this._eventKey;
	}

	get eventData() {
		return this._eventData;
	}

	get event() {
		return this._eventData.event;
	}

	get eventType(): string {
		return this._eventData.eventType;
	}

	get eventDataString() {
		return JSON.stringify(this._eventData);
	}

	get eventTimestamp() {
		return this._eventTimestamp;
	}

	get retryCount() {
		return this._eventData.retryCount;
	}

	get connectFailureCount() {
		return this._eventData.connectFailureCount;
	}

	incrementRetryCount() {
		this._eventData.retryCount++;
	}

	incrementConnectFailureCount(): void {
		this._eventData.connectFailureCount++;
	}
}

export interface IEventBusSubscriber<EventBusEvent> {
	setupSubscriptions(): void;
}

export type EventBusHandler = (event: EventBusEvent<unknown>) => void;

export interface IEventBus {
	publishEventsBulk(events: EventBusEvent<unknown>[]): Promise<Result<EventBusEvent<unknown>[], InfrastructureErrors.EventBusError>>;
	publishEvent(event: EventBusEvent<unknown>): Promise<Result<EventBusEvent<unknown>, InfrastructureErrors.EventBusError>>;
	subscribe(eventName: string, handler: EventBusHandler): void;
	clearHandlers(): void;
}
