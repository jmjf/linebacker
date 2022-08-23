import { err, ok, Result } from '../../../common/core/Result';
import { AzureQueue } from '../../../common/infrastructure/AzureQueue';
import { BackupRequest } from '../../domain/BackupRequest';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';
import { StoreDeleteResponse, StoreReceiveResponse, StoreSendResponse } from '../IBackupInterfaceStoreAdapter';

export class AzureBackupInterfaceStoreAdapter {
	private queueName: string;
	private useBase64: boolean;

	constructor(queueName: string, useBase64 = false) {
		this.queueName = queueName;
		this.useBase64 = useBase64;
	}

	public async send(
		backupRequest: BackupRequest
	): Promise<Result<StoreSendResponse, AdapterErrors.StoreAdapterError>> {
		const messageText = JSON.stringify(this.mapToQueue(backupRequest));

		const sendStart = new Date();
		const sendResult = await AzureQueue.sendMessage({
			queueName: this.queueName,
			messageText,
			useBase64: this.useBase64,
		});
		const sendEnd = new Date();

		if (sendResult.isErr()) {
			return err(
				new AdapterErrors.StoreAdapterError(
					`{message: '${sendResult.error.message}', name: '${sendResult.error.name}', code: '${sendResult.error.code}'}`
				)
			);
		}

		const response: StoreSendResponse = {
			backupRequestId: backupRequest.backupRequestId.value,
			isSent: sendResult.value.isSent,
			responseStatus: sendResult.value.responseStatus,
			sendStart,
			sendEnd,
			insertedOn: sendResult.value.insertedOn,
			messageId: sendResult.value.messageId,
			sendRequestId: sendResult.value.requestId,
		};
		return ok(response);
	}

	public async receive(messageCount: number): Promise<Result<StoreReceiveResponse, AdapterErrors.StoreAdapterError>> {
		return ok({} as StoreReceiveResponse);
	}

	public async delete(
		messageId: string,
		popReceipt: string
	): Promise<Result<StoreDeleteResponse, AdapterErrors.StoreAdapterError>> {
		return ok({} as StoreDeleteResponse);
	}

	public async isReady(): Promise<Result<boolean, AdapterErrors.StoreAdapterError>> {
		return ok(true);
	}

	private mapToQueue(backupRequest: BackupRequest) {
		return {
			backupRequestId: backupRequest.backupRequestId.value,
			backupJobId: backupRequest.backupJobId.value,
			dataDate: backupRequest.dataDate.toISOString().slice(0, 10), // date part only
			preparedDataPathName: backupRequest.preparedDataPathName,
		};
	}
}
