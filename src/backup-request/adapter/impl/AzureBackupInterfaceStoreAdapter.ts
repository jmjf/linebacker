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
	): Promise<Result<StoreSendResponse, AdapterErrors.InterfaceAdapterError>> {
		const messageText = JSON.stringify(this.mapToQueue(backupRequest));

		const startTime = new Date();
		const sendResult = await AzureQueue.sendMessage({
			queueName: this.queueName,
			messageText,
			useBase64: this.useBase64,
		});
		const endTime = new Date();

		if (sendResult.isErr()) {
			return err(
				new AdapterErrors.InterfaceAdapterError(
					`{context: 'AzureBackupInterfaceStoreAdapter.send', message: '${sendResult.error.message}', name: '${
						sendResult.error.name
					}', code: '${
						sendResult.error.code
					}, startTime: '${startTime.toISOString()}', endTime: '${endTime.toISOString()}' }`
				)
			);
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
			return err(
				new AdapterErrors.InterfaceAdapterError(
					`{context: 'AzureBackupInterfaceStoreAdapter.receive', message: '${rcvResult.error.message}', name: '${
						rcvResult.error.name
					}', code: '${
						rcvResult.error.code
					}, startTime: '${startTime.toISOString()}', endTime: '${endTime.toISOString()}' }`
				)
			);
		}

		return ok({ messages: rcvResult.value.receivedMessageItems, startTime, endTime } as StoreReceiveResponse);
	}

	public async delete(
		messageId: string,
		popReceipt: string
	): Promise<Result<StoreDeleteResponse, AdapterErrors.InterfaceAdapterError>> {
		const startTime = new Date();
		const deleteResult = await AzureQueue.deleteMessage({ queueName: this.queueName, messageId, popReceipt });
		const endTime = new Date();

		if (deleteResult.isErr()) {
			return err(
				new AdapterErrors.InterfaceAdapterError(
					`{context: 'AzureBackupInterfaceStoreAdapter.delete', message: '${deleteResult.error.message}', name: '${
						deleteResult.error.name
					}', code: '${
						deleteResult.error.code
					}, startTime: '${startTime.toISOString()}', endTime: '${endTime.toISOString()}' }`
				)
			);
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
