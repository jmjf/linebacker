import { IEventBusEvent, IEventBusEventData } from '../../infrastructure/event-bus/IEventBus';
import { BackupRequest } from './BackupRequest';

export interface BackupRequestReceivedEventData {
	// After received, all consumers must get data from persisted data
	// so we only need the request id so they can find it
	domainEvent: {
		backupRequestId: string;
	};
}

export class BackupRequestReceived implements IEventBusEvent {
	private _eventTimestamp: Date;
	private _eventData: IEventBusEventData & BackupRequestReceivedEventData;
	private _eventKey: string;
	private _topicName: string;

	constructor(backupRequest: BackupRequest) {
		this._eventTimestamp = new Date();
		this._topicName = 'backup-request-received';
		this._eventData = {
			connectFailureCount: 0,
			retryCount: 0,
			domainEvent: {
				backupRequestId: backupRequest.backupRequestId.value,
			},
		};
		this._eventKey = this._eventData.domainEvent.backupRequestId;
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

	get domainEventData() {
		return this._eventData.domainEvent;
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
