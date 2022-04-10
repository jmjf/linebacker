import { IBackupRequestRepo } from '../adapter/BackupRequestRepo';
import { BackupRequest } from '../domain/BackupRequest';

interface IBackupRepoFactoryParams {
	existsResult?: boolean;
	getRequestByIdResult?: BackupRequest;
}
export function backupRequestRepoFactory(
	params?: IBackupRepoFactoryParams
): IBackupRequestRepo {
	return <IBackupRequestRepo>{
		exists(requestId: string): Promise<boolean> {
			return new Promise((res) => params?.existsResult || true);
		},

		getRequestByRequestId(requestId: string): Promise<BackupRequest> {
			return new Promise((res) => {
				return params?.getRequestByIdResult || ({} as BackupRequest);
			});
		},

		save(backupRequest: BackupRequest): Promise<void> {
			return new Promise((res) => {
				return;
			});
		},
	};
}
