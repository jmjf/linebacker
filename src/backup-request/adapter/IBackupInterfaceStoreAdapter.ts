import { Result } from '../../common/core/Result';
import * as AdapterErrors from '../../common/adapter/AdapterErrors';

import { BackupRequest } from '../domain/BackupRequest';

export interface StoreSendResponse {
	backupRequestId: string;
	isSent: boolean;
	responseStatus: number;
	sendStart: Date;
	sendEnd: Date;
	insertedOn?: Date;
	messageId?: string;
	sendRequestId?: string;
}

export interface StoreReceiveResponse {
	messageText: string; // won't be this, but putting something here for now
}

export interface StoreDeleteResponse {
	messageText: string; // won't be this, but putting something here for now
}

export interface StoreDeleteResponse {
	messageText: string; // won't be this, but putting something here for now
}

export interface StoreIsReadyResponse {
	messageText: string; // won't be this, but putting something here for now
}

export interface IBackupInterfaceStoreAdapter {
	// may be void if circuit breaker keeps a list of messages
	send(backupRequest: BackupRequest): Promise<Result<StoreSendResponse, AdapterErrors.StoreAdapterError>>;

	receive(messageCount: number): Promise<Result<StoreReceiveResponse, AdapterErrors.StoreAdapterError>>;

	delete(messageId: string, popReceipt: string): Promise<Result<StoreDeleteResponse, AdapterErrors.StoreAdapterError>>;

	isReady(): Promise<Result<boolean, AdapterErrors.StoreAdapterError>>;
}
