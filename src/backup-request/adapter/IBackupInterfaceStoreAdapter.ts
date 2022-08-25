import { Result } from '../../common/core/Result';
import * as AdapterErrors from '../../common/adapter/AdapterErrors';

import { BackupRequest } from '../domain/BackupRequest';

export interface StoreSendResponse {
	backupRequestId: string;
	isSent: boolean;
	responseStatus: number;
	insertedOn?: Date;
	messageId?: string;
	sendRequestId?: string;
	startTime: Date;
	endTime: Date;
}

export interface StoreReceiveResponse {
	messages: unknown[];
	startTime: Date;
	endTime: Date;
}

export interface StoreDeleteResponse {
	responseStatus: number;
	startTime: Date;
	endTime: Date;
}

export interface StoreIsReadyResponse {
	messageText: string; // won't be this, but putting something here for now
}

export interface IBackupInterfaceStoreAdapter {
	// may be void if circuit breaker keeps a list of messages
	send(backupRequest: BackupRequest): Promise<Result<StoreSendResponse, AdapterErrors.InterfaceAdapterError>>;

	receive(messageCount: number): Promise<Result<StoreReceiveResponse, AdapterErrors.InterfaceAdapterError>>;

	delete(
		messageId: string,
		popReceipt: string
	): Promise<Result<StoreDeleteResponse, AdapterErrors.InterfaceAdapterError>>;

	isReady(): Promise<Result<boolean, AdapterErrors.InterfaceAdapterError>>;
}
