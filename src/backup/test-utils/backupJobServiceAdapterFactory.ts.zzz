import { err, ok, Result } from '../../common/core/Result';
import * as AdapterErrors from '../../common/adapter/AdapterErrors';

import { IBackupJobServiceAdapter } from '../../backup-job/adapter/BackupJobServiceAdapter';
import { BackupJob } from '../../backup-job/domain/BackupJob';

interface IBackupJobServiceAdapterFactoryParams {
	getBackupJobResult?: BackupJob;
}

export function backupJobServiceAdapterFactory(
	params?: IBackupJobServiceAdapterFactoryParams
): IBackupJobServiceAdapter {
	return <IBackupJobServiceAdapter>{
		getBackupJob(
			backupJobId: string
		): Promise<Result<BackupJob, AdapterErrors.BackupJobServiceError>> {
			if (!params || !params.getBackupJobResult) {
				return Promise.resolve(
					err(
						new AdapterErrors.BackupJobServiceError(
							'BackupJobServiceAdapter getBackupJobResult not defined'
						)
					)
				);
			}
			return Promise.resolve(ok(params.getBackupJobResult));
		},
	};
}
