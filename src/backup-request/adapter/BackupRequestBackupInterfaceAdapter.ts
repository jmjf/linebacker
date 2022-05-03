import { BackupRequest } from '../domain/BackupRequest';

export interface IBackupRequestBackupInterfaceAdapter {
   sendMessage(backupRequest: BackupRequest): Promise<boolean>; // may be void if circuit breaker keeps a queue of messages
}