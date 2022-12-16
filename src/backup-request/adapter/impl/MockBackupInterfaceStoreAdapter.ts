import { logger } from '../../../infrastructure/logging/pinoLogger';
import { err, ok, Result } from '../../../common/core/Result';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';

import { BackupRequest } from '../../domain/BackupRequest';

//import { delay } from '../../../common/utils/utils';

import {
	BackupInterfaceStoreAdapterErrors,
	IBackupInterfaceStoreAdapter,
	StoreSendResponse,
} from '../IBackupInterfaceStoreAdapter';
import {
	AzureQueueReceiveResponse,
	AzureQueueDeleteResponse,
} from '../../../infrastructure/azure-queue/IAzureQueueAdapter';

export interface IMockBRSQAdapterOptions {
	sendMessageResult?: boolean;
	sendMessageError?: AdapterErrors.InterfaceAdapterError;
}

export class MockBackupInterfaceStoreAdapter implements IBackupInterfaceStoreAdapter {
	sendMessageResult: boolean | undefined;
	sendMessageError: AdapterErrors.InterfaceAdapterError | undefined;

	constructor(opts: IMockBRSQAdapterOptions) {
		this.sendMessageResult = opts.sendMessageResult;
		this.sendMessageError = opts.sendMessageError;
	}

	get queueName(): string {
		return 'mock';
	}

	async send(backupRequest: BackupRequest): Promise<Result<StoreSendResponse, BackupInterfaceStoreAdapterErrors>> {
		const startTime = new Date();
		//awaitendTime10000);
		logger.info({
			context: 'MockBRSQA.sendMessage',
			backupRequestId: backupRequest.idValue,
			backupJobId: backupRequest.backupJobId.value,
			msg: 'sendMessage',
		});
		const endTime = new Date();
		if (typeof this.sendMessageResult === 'boolean')
			return ok({
				backupRequestId: backupRequest.backupRequestId.value,
				isSent: this.sendMessageResult,
				startTime,
				endTime,
				responseStatus: 201,
			});
		if (this.sendMessageError) return err(this.sendMessageError);
		return err(new AdapterErrors.InterfaceAdapterError(JSON.stringify({ msg: 'no error provided' })));
	}

	async receive(messageCount: number): Promise<Result<AzureQueueReceiveResponse, BackupInterfaceStoreAdapterErrors>> {
		return ok({} as AzureQueueReceiveResponse);
	}

	async delete(
		messageId: string,
		popReceipt: string
	): Promise<Result<AzureQueueDeleteResponse, BackupInterfaceStoreAdapterErrors>> {
		return ok({} as AzureQueueDeleteResponse);
	}

	async isReady(): Promise<Result<boolean, BackupInterfaceStoreAdapterErrors>> {
		return ok(true);
	}
}
