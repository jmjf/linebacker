import { Result } from '../../common/core/Result';
import * as AdapterErrors from '../../common/adapter/AdapterErrors';
import * as InfrastructureErrors from '../../common/infrastructure/InfrastructureErrors';

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

export type BackupInterfaceStoreAdapterErrors =
	| AdapterErrors.InterfaceAdapterError
	| InfrastructureErrors.InputError
	| InfrastructureErrors.EnvironmentError
	| InfrastructureErrors.SDKError;

export interface IBackupInterfaceStoreAdapter extends IAzureQueueAdapter {
	// may be void if circuit breaker keeps a list of messages
	send(backupRequest: BackupRequest): Promise<Result<StoreSendResponse, BackupInterfaceStoreAdapterErrors>>;

	/** IAzureQueueAdapter requires implementing the following methods
	 *
	 * get queueName(): string;
	 *
	 * receive(messageCount: number): Promise<Result<AzureQueueReceiveResponse, BackupInterfaceStoreAdapterErrors>>;
	 *
	 * delete(messageId: string, popReceipt: string): Promise<Result<AzureQueueDeleteResponse, BackupInterfaceStoreAdapterErrors>>;
	 *
	 */
}
