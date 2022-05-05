import { BackupJob } from '../domain/BackupJob';

export interface IBackupJobServiceAdapter {
   getBackupJob(backupJobId: string): Promise<BackupJob>; // may be void if circuit breaker keeps a queue of messages
}