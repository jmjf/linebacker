import { IBackupJobServiceAdapter } from '../adapter/BackupJobServiceAdapter';
import { BackupJob } from '../domain/BackupJob';

interface IBackupJobServiceAdapterFactoryParams {
   getBackupJobResult?: BackupJob;
}

export function backupJobServiceAdapterFactory(params?: IBackupJobServiceAdapterFactoryParams): IBackupJobServiceAdapter {
   return <IBackupJobServiceAdapter> {
      getBackupJob(backupJobId: string): Promise<BackupJob> {
         return Promise.resolve(params?.getBackupJobResult ? params.getBackupJobResult : {} as BackupJob );
      }
   };
}