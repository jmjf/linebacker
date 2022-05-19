import { Result } from '../../common/core/Result';
import * as ApplicationError from '../../common/application/ApplicationErrors';
import { BackupRequest } from '../domain/BackupRequest';

export interface IBackupRequestRepo {
   exists(requestId: string): Promise<boolean>;
   getById(requestId: string): Promise<Result<BackupRequest, ApplicationError.UnexpectedError>>;
   save(backupRequest: BackupRequest): Promise<Result<BackupRequest, ApplicationError.UnexpectedError>>;
}