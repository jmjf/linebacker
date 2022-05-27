import { Result } from '../../common/core/Result';
import * as AdapterErrors from '../../common/adapter/AdapterErrors';
import { BackupRequest } from '../domain/BackupRequest';

export interface IBackupRequestRepo {
   exists(requestId: string): Promise<Result<boolean, AdapterErrors.DatabaseError>>;
   getById(requestId: string): Promise<Result<BackupRequest, AdapterErrors.DatabaseError | AdapterErrors.NotFoundError>>;
   save(backupRequest: BackupRequest): Promise<Result<BackupRequest, AdapterErrors.DatabaseError>>;
}