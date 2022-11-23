import { IEventBusEvent, IEventBusEventData } from '../../common/infrastructure/event-bus/IEventBus';
import { BackupRequest } from './BackupRequest';

export interface BackupRequestAllowedEventData {
	// After received, all consumers must get data from persisted data
	// so we only need the request id so they can find it
	event: {
		backupRequestId: string;
	};
}

export class BackupRequestAllowed implements IEventBusEvent {
	private _eventTimestamp: Date;
	private _eventData: IEventBusEventData & BackupRequestAllowedEventData;
	private _eventKey: string;
	private _topicName: string;

	constructor(backupRequest: BackupRequest) {
		this._eventTimestamp = new Date();
		this._topicName = 'linebacker';
		this._eventData = {
			connectFailureCount: 0,
			retryCount: 0,
			eventType: this.constructor.name,
			event: {
				backupRequestId: backupRequest.backupRequestId.value,
			},
		};
		this._eventKey = this._eventData.event.backupRequestId;
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
}
