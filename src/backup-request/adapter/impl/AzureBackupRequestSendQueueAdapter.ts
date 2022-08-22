import { err, ok, Result } from '../../../common/core/Result';
import { AzureQueue } from '../../../common/infrastructure/AzureQueue';
import { BackupRequest } from '../../domain/BackupRequest';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';
import { SendMessageResponse } from '../IBackupRequestSendQueueAdapter';

export class AzureBackupRequestSendQueueAdapter {
	private queueName: string;
	private useBase64: boolean;

	constructor(queueName: string, useBase64 = false) {
		this.queueName = queueName;
		this.useBase64 = useBase64;
	}

	public async sendMessage(
		backupRequest: BackupRequest
	): Promise<Result<SendMessageResponse, AdapterErrors.SendQueueAdapterError>> {
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
				new AdapterErrors.SendQueueAdapterError(
					`{message: '${sendResult.error.message}', name: '${sendResult.error.name}', code: '${sendResult.error.code}'}`
				)
			);
		}
		const response: SendMessageResponse = {
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

	private mapToQueue(backupRequest: BackupRequest) {
		return {
			backupRequestId: backupRequest.backupRequestId.value,
			backupJobId: backupRequest.backupJobId.value,
			dataDate: backupRequest.dataDate.toISOString().slice(0, 10), // date part only
			preparedDataPathName: backupRequest.preparedDataPathName,
		};
	}
}
