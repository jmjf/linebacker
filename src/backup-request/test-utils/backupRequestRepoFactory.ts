import { IBackupRequestRepo } from '../adapter/BackupRequestRepo';
import { BackupRequest } from '../domain/BackupRequest';
import { DomainEventBus } from '../../common/domain/DomainEventBus';

interface IBackupRequestRepoFactoryParams {
	existsResult?: boolean;
	getByIdResult?: BackupRequest;
}
export function backupRequestRepoFactory(
	params?: IBackupRequestRepoFactoryParams
): IBackupRequestRepo {
	return <IBackupRequestRepo>{
		exists(requestId: string): Promise<boolean> {
			return Promise.resolve(params?.existsResult === undefined || params?.existsResult === null ? true : params?.existsResult);
		},

		async getById(requestId: string): Promise<BackupRequest> {
			if (!params || !params.getByIdResult || !requestId) {
				throw new Error('BackupRequestRepo getByIdResult not found');
			}
			return Promise.resolve(params.getByIdResult);
		},

		save(backupRequest: BackupRequest): Promise<void> {
			DomainEventBus.publishEventsForAggregate(backupRequest.backupRequestId);
			return Promise.resolve();
		},
	};
}
