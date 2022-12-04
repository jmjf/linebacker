import { EventBusEvent } from '../../common/infrastructure/event-bus/IEventBus';
import { StoreStatusMessageItem } from './StoreStatusReceived.common';

export interface StoreStatusReceivedEventData_MEM {
	event: StoreStatusMessageItem;
}

export class StoreStatusReceived_MEM extends EventBusEvent<StoreStatusReceivedEventData_MEM> {
	constructor(queueMessage: StoreStatusMessageItem) {
		super();
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
					messageText: messageObject.messageText,
				},
			},
		};
		this._eventKey = `${this._eventData.event.messageId}|${this._eventData.event.popReceipt}`;
	}
}
