import { Result } from '../../common/core/Result';
import * as AdapterErrors from '../../common/adapter/AdapterErrors';
import * as DomainErrors from '../../common/domain/DomainErrors';

import { BackupJob } from '../domain/BackupJob';

export interface IBackupJobServiceAdapter {
	getById(
		backupJobId: string,
		backupRequestId?: string
	): Promise<
		Result<BackupJob, AdapterErrors.BackupJobServiceError | AdapterErrors.NotFoundError | DomainErrors.PropsError>
	>;
}
