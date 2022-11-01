import { Result } from '../../common/core/Result';
import * as AdapterErrors from '../../common/adapter/AdapterErrors';

import { BackupRequest } from '../domain/BackupRequest';
import { IAzureQueueAdapter } from '../../infrastructure/azure-queue/IAzureQueueAdapter';

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

export interface StoreIsReadyResponse {
	messageText: string; // won't be this, but putting something here for now
}

export interface IBackupInterfaceStoreAdapter {
	// may be void if circuit breaker keeps a list of messages
	send(backupRequest: BackupRequest): Promise<Result<StoreSendResponse, AdapterErrors.InterfaceAdapterError>>;

	/** IAzureQueueAdapter requires implementing the following methods
	 * 
	 * receive(messageCount: number): Promise<Result<AzureQueueReceiveResponse, AdapterErrors.InterfaceAdapterError>>;
	 * 
	 * 	delete(
	 * 		messageId: string,
	 * 		popReceipt: string
	 * 	): Promise<Result<AzureQueueDeleteResponse, AdapterErrors.InterfaceAdapterError>>;
	 * 	
	*/
}
