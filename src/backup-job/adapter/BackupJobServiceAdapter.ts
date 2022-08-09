import { Result } from '../../common/core/Result';
import * as AdapterErrors from '../../common/adapter/AdapterErrors';

import { BackupJob } from '../domain/BackupJob';

export interface IBackupJobServiceAdapter {
	getById(
		backupJobId: string,
		backupRequestId: string
	): Promise<Result<BackupJob, AdapterErrors.BackupJobServiceError>>; // may be void if circuit breaker keeps a queue of messages
}
