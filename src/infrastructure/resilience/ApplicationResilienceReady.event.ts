import { EventBusEvent } from '../../common/infrastructure/event-bus/IEventBus';

export interface ApplicationResilienceReadyEventData {
	// After received, all consumers must get data from persisted data
	// so we only need the request id so they can find it
	event: {
		beforeTimestamp: Date;
	};
}

export class ApplicationResilienceReady extends EventBusEvent<ApplicationResilienceReadyEventData> {

	constructor(beforeTimestamp: Date) {
		super();
		this._eventData = {
			connectFailureCount: 0,
			retryCount: 0,
			eventType: this.constructor.name,
			event: {
				beforeTimestamp
			},
		};
		this._eventKey = this._eventData.event.beforeTimestamp.toISOString();
	}
}
