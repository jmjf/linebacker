import { Result } from '../../common/core/Result';
import * as AdapterErrors from '../../common/adapter/AdapterErrors';
import { Backup } from '../domain/Backup';

export interface IBackupRepo {
	exists(backupId: string): Promise<Result<boolean, AdapterErrors.DatabaseError>>;
	getById(backupId: string): Promise<Result<Backup, AdapterErrors.DatabaseError | AdapterErrors.NotFoundError>>;
	getByBackupRequestId(
		backupRequestId: string
	): Promise<Result<Backup, AdapterErrors.DatabaseError | AdapterErrors.NotFoundError>>;
	save(backup: Backup): Promise<Result<Backup, AdapterErrors.DatabaseError>>;
}
