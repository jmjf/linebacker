import { Backup } from '../domain/Backup';

export interface IBackupRepo {
   exists(backupId: string): Promise<boolean>;
   getById(backupId: string): Promise<Backup>;
   save(backup: Backup): Promise<void>;
}