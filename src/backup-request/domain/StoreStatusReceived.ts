import { IDomainEvent } from '../../common/domain/DomainEventBus';
import { UniqueIdentifier } from '../../common/domain/UniqueIdentifier';

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

export class StoreStatusReceived implements IDomainEvent {
	public eventTimestamp: Date;
	public messageItem: StoreStatusMessageItem;

	constructor(messageItem: StoreStatusMessageItem) {
		this.eventTimestamp = new Date();
		this.messageItem = messageItem;

		// temporary, for early testing
		// console.log('StoreStatusReceived constructor called with messageItem', messageItem);
	}

	// this event isn't related to an aggregate
	getAggregateId(): UniqueIdentifier {
		return undefined as unknown as UniqueIdentifier;
	}
}
