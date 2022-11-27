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
