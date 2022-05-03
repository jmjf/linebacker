
import { IBackupRequestBackupInterfaceAdapter } from '../adapter/BackupRequestBackupInterfaceAdapter';
import { BackupRequest } from '../domain/BackupRequest';

interface IBackupInterfaceAdapterFactoryParams {
	sendMessageResult?: boolean;
}
export function backupInterfaceAdapterFactory(
	params?: IBackupInterfaceAdapterFactoryParams
): IBackupRequestBackupInterfaceAdapter {
	return <IBackupRequestBackupInterfaceAdapter> {
		sendMessage(backupRequest: BackupRequest): Promise<boolean> {
			return Promise.resolve(params?.sendMessageResult === undefined || params?.sendMessageResult === null ? true : params.sendMessageResult);
		},
	};
}
