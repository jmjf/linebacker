import { err, ok, Result } from '../../../common/core/Result';
import { AzureQueue } from '../../../common/infrastructure/AzureQueue';
import { BackupRequest } from '../../domain/BackupRequest';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';
import { SendMessageResponse } from '../IBackupRequestSendQueueAdapter';

export class AzureBackupRequestSendQueueAdapter {
	private queueName: string;

	constructor(queueName: string) {
		this.queueName = queueName;
	}

	public async sendMessage(
		backupRequest: BackupRequest
	): Promise<Result<SendMessageResponse, AdapterErrors.SendQueueAdapterError>> {
		const message = JSON.stringify(this.mapToQueue(backupRequest));

		const sendStart = new Date();
		const sendResult = await AzureQueue.sendMessage(this.queueName, message);
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
			sendRequestId: sendResult.value.sendRequestId,
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
