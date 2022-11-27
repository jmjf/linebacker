import { EventBusEvent } from '../../common/infrastructure/event-bus/IEventBus';
import { StoreStatusMessage, StoreStatusMessageItem } from './StoreStatusReceived.common';

export interface StoreStatusReceivedEventData_BMQ {
	event: StoreStatusMessage;
}

export class StoreStatusReceived_BMQ extends EventBusEvent<StoreStatusReceivedEventData_BMQ> {
	constructor(eventData: StoreStatusMessageItem) {
		const { messageObject, messageId } = eventData;
		super();
		this._eventData = {
			connectFailureCount: 0,
			retryCount: 0,
			eventType: this.constructor.name,
			event: {
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
		};
		this._eventKey = `${messageId}`;
	}
}
