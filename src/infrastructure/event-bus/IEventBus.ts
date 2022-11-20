export interface IEventBusEventData {
	connectFailureCount: number;
	retryCount: number;
}

export interface IEventBusEvent {
	get eventKey(): string;
	get eventData(): unknown;
	get eventDataString(): string;
	get domainEventData(): unknown;
	get topicName(): string;
	get eventTimestamp(): Date;
	get retryCount(): number;
	incrementRetryCount(): void;
}
