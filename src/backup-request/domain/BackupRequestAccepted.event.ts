import { IEventBusEvent, IEventBusEventData } from '../../infrastructure/event-bus/IEventBus';
import { BackupRequest } from './BackupRequest';

import { BackupRequestStatusType } from './BackupRequestStatusType';
import { RequestTransportType } from './RequestTransportType';

export interface BackupRequestAcceptedEventData {
	domainEvent: {
		backupRequestId: string;
		backupJobId: string;
		dataDate: Date;
		preparedDataPathName: string;
		statusTypeCode: BackupRequestStatusType;
		transportTypeCode: RequestTransportType;
		getOnStartFlag: boolean;
		receivedTimestamp: Date;
		requesterId: string;
	};
}

export class BackupRequestAccepted implements IEventBusEvent {
	private _eventTimestamp: Date;
	private _eventData: IEventBusEventData & BackupRequestAcceptedEventData;
	private _eventKey: string;
	private _topicName: string;

	constructor(backupRequest: BackupRequest) {
		this._eventTimestamp = new Date();
		this._topicName = 'linebacker';
		this._eventData = {
			connectFailureCount: 0,
			retryCount: 0,
			eventName: this.constructor.name,
			domainEvent: {
				backupRequestId: backupRequest.backupRequestId.value,
				backupJobId: backupRequest.backupJobId.value,
				dataDate: backupRequest.dataDate,
				preparedDataPathName: backupRequest.preparedDataPathName,
				statusTypeCode: backupRequest.statusTypeCode,
				transportTypeCode: backupRequest.transportTypeCode,
				getOnStartFlag: backupRequest.getOnStartFlag,
				receivedTimestamp: backupRequest.receivedTimestamp,
				requesterId: backupRequest.requesterId,
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
