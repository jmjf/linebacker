
import { IEventBusEvent, IEventBusEventData } from '../../common/infrastructure/event-bus/IEventBus';

export interface StoreStatusReceivedEventData {
	event: StoreStatusMessageItem;
}

export interface StoreStatusMessageItem {
   dequeueCount: number;
   messageId: string;
   popReceipt: string;
   messageObject: StoreStatusMessage;
}

export interface StoreStatusMessage {
	apiVersion: string; // yyyy-mm-dd
	backupRequestId: string; // -> UniqueIdentifier (UUIDv4)
	storagePathName: string;
	resultTypeCode: string; // -> ReplyResultType
	backupByteCount: number;
	copyStartTimestamp: string; // Date
	copyEndTimestamp: string; // Date
	verifyStartTimestamp?: string; // Date
	verifyEndTimestamp?: string; // Date
	verifiedHash?: string;
	messageText?: string;
}

export class StoreStatusReceived implements IEventBusEvent {
	private _eventTimestamp: Date;
	private _eventData: IEventBusEventData & StoreStatusReceivedEventData;
	private _eventKey: string;
	private _topicName: string;

	constructor(queueMessage: StoreStatusMessageItem) {
		this._eventTimestamp = new Date();
		this._topicName = 'linebacker';
      const { dequeueCount, messageId, popReceipt, messageObject } = queueMessage;
		this._eventData = {
			connectFailureCount: 0,
			retryCount: 0,
			eventType: this.constructor.name,
			event: {
            dequeueCount,
            messageId,
            popReceipt,
            messageObject: {
               apiVersion: messageObject.apiVersion,
               backupRequestId: messageObject.backupRequestId,
               storagePathName: messageObject.storagePathName,
               resultTypeCode: messageObject.resultTypeCode,
               backupByteCount: messageObject.backupByteCount,
               copyStartTimestamp: messageObject.copyStartTimestamp,
               copyEndTimestamp: messageObject.copyEndTimestamp,
               verifyStartTimestamp: messageObject.verifyStartTimestamp,
               verifyEndTimestamp: messageObject.verifyEndTimestamp,
               verifiedHash: messageObject.verifiedHash,
               messageText: messageObject.messageText
            }
			},
		};
		this._eventKey = `${this._eventData.event.messageId}|${this._eventData.event.popReceipt}`;
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
