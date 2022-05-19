import { Result } from '../../common/core/Result';
import * as AdapterErrors from '../../common/adapter/AdapterErrors';
import { BackupRequest } from '../domain/BackupRequest';

export interface IBackupRequestRepo {
   exists(requestId: string): Promise<boolean>;
   getById(requestId: string): Promise<Result<BackupRequest, AdapterErrors.DatabaseError>>;
   save(backupRequest: BackupRequest): Promise<Result<BackupRequest, AdapterErrors.DatabaseError>>;
}