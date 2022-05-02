import { IBackupRequestRepo } from '../adapter/BackupRequestRepo';
import { BackupRequest } from '../domain/BackupRequest';

interface IBackupRepoFactoryParams {
	existsResult?: boolean;
	getByIdResult?: BackupRequest;
}
export function backupRequestRepoFactory(
	params?: IBackupRepoFactoryParams
): IBackupRequestRepo {
	return <IBackupRequestRepo>{
		exists(requestId: string): Promise<boolean> {
			return Promise.resolve(params?.existsResult === undefined || params?.existsResult === null ? true : params?.existsResult);
		},

		async getById(requestId: string): Promise<BackupRequest> {
			return Promise.resolve(params?.getByIdResult ? params.getByIdResult : {} as BackupRequest);
		},

		save(backupRequest: BackupRequest): Promise<void> {
			return Promise.resolve();
		},
	};
}
