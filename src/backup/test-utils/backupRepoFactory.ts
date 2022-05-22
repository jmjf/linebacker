import { DomainEventBus } from '../../common/domain/DomainEventBus';
import { Backup } from '../domain/Backup';
import { IBackupRepo } from '../adapter/BackupRepo';

interface IBackupRepoFactoryParams {
	existsResult?: boolean;
	getByIdResult?: Backup;
	failSave?: boolean;
}
export function backupRepoFactory(
	params?: IBackupRepoFactoryParams
): IBackupRepo {
	return <IBackupRepo>{
		exists(requestId: string): Promise<boolean> {
			return Promise.resolve(params?.existsResult === undefined || params?.existsResult === null ? true : params?.existsResult);
		},

		async getById(requestId: string): Promise<Backup> {
			if (!params || !params.getByIdResult) {
				throw new Error('BackupRepo getByIdResult not defined');
			}
			return Promise.resolve(params.getByIdResult);
		},

		save(backup: Backup): Promise<void> {
			if (params?.failSave) {
				throw new Error('BackupRepo failSave true');
			}
			DomainEventBus.publishEventsForAggregate(backup.backupId);
			return Promise.resolve();
		},
	};
}
