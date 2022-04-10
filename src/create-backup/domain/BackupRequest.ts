import { Entity } from '../../common/domain/Entity';
import { Result } from '../../common/domain/Result';

interface BackupRequestProps {
   backupRequestId: string
   // need to add the rest of the properties, but this is enough for now
}

export class BackupRequest extends Entity<BackupRequestProps> {
   get backupRequestId (): string {
      return this.backupRequestId;
   }

   private constructor (props: BackupRequestProps, id?: string) {
      super(props, id);
   }

   public static create (props:BackupRequestProps, id?: string): Result<BackupRequest> {
      return Result.ok<BackupRequest>(new BackupRequest(props, id));
   }
}