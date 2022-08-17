import { IBackupRequestSendQueueAdapter } from '../adapter/BackupRequestSendQueueAdapter';
import { BackupRequest } from '../domain/BackupRequest';

interface ISendQueueAdapterFactoryParams {
	sendMessageResult?: boolean;
}
export function sendQueueAdapterFactory(
	params?: ISendQueueAdapterFactoryParams
): IBackupRequestSendQueueAdapter {
	return <IBackupRequestSendQueueAdapter>{
		sendMessage(backupRequest: BackupRequest): Promise<boolean> {
			return Promise.resolve(
				params?.sendMessageResult === undefined ||
					params?.sendMessageResult === null
					? true
					: params.sendMessageResult
			);
		},
	};
}
