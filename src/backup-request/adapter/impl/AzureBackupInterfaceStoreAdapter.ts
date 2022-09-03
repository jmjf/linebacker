import { err, ok, Result } from '../../../common/core/Result';
import { AzureQueue } from '../../../common/infrastructure/AzureQueue';
import { BackupRequest } from '../../domain/BackupRequest';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';
import { StoreDeleteResponse, StoreReceiveResponse, StoreSendResponse } from '../IBackupInterfaceStoreAdapter';

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);

export class AzureBackupInterfaceStoreAdapter {
	private queueName: string;
	private useBase64: boolean;

	constructor(queueName: string, useBase64 = false) {
		this.queueName = queueName;
		this.useBase64 = useBase64;
	}

	public async send(
		backupRequest: BackupRequest
	): Promise<Result<StoreSendResponse, AdapterErrors.InterfaceAdapterError>> {
		const functionName = 'send';
		const messageText = JSON.stringify(this.mapToQueue(backupRequest));

		const startTime = new Date();
		const sendResult = await AzureQueue.sendMessage({
			queueName: this.queueName,
			messageText,
			useBase64: this.useBase64,
		});
		const endTime = new Date();

		if (sendResult.isErr()) {
			return err(sendResult.error);
		}

		const response: StoreSendResponse = {
			backupRequestId: backupRequest.backupRequestId.value,
			isSent: sendResult.value.isSent,
			responseStatus: sendResult.value.responseStatus,
			startTime,
			endTime,
			insertedOn: sendResult.value.insertedOn,
			messageId: sendResult.value.messageId,
			sendRequestId: sendResult.value.requestId,
		};
		return ok(response);
	}

	public async receive(
		messageCount: number
	): Promise<Result<StoreReceiveResponse, AdapterErrors.InterfaceAdapterError>> {
		const functionName = 'receive';
		// ensure messageCount is usable
		if (typeof messageCount !== 'number' || messageCount < 1) messageCount = 1;

		const startTime = new Date();
		const rcvResult = await AzureQueue.receiveMessages({
			queueName: this.queueName,
			useBase64: this.useBase64,
			messageCount,
		});
		const endTime = new Date();

		if (rcvResult.isErr()) {
			return err(rcvResult.error);
		}

		return ok({ messages: rcvResult.value.receivedMessageItems, startTime, endTime } as StoreReceiveResponse);
	}

	public async delete(
		messageId: string,
		popReceipt: string
	): Promise<Result<StoreDeleteResponse, AdapterErrors.InterfaceAdapterError>> {
		const functionName = 'delete';
		const startTime = new Date();
		const deleteResult = await AzureQueue.deleteMessage({ queueName: this.queueName, messageId, popReceipt });
		const endTime = new Date();

		if (deleteResult.isErr()) {
			return err(deleteResult.error);
		}

		return ok({ responseStatus: deleteResult.value.responseStatus, startTime, endTime });
	}

	public async isReady(): Promise<Result<boolean, AdapterErrors.InterfaceAdapterError>> {
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
