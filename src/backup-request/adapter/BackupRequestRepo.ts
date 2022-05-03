import { BackupRequest } from '../domain/BackupRequest';

export interface IBackupRequestRepo {
   exists(requestId: string): Promise<boolean>;
   getById(requestId: string): Promise<BackupRequest>;
   save(backupRequest: BackupRequest): Promise<void>;
}