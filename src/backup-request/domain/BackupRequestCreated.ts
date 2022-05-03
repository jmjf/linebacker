import { IDomainEvent } from '../../common/domain/DomainEventBus';
import { UniqueIdentifier } from '../../common/domain/UniqueIdentifier';
import { BackupRequest } from './BackupRequest';

export class BackupRequestCreated implements IDomainEvent {
   public eventTimestamp: Date;
   public backupRequest: BackupRequest;

   constructor(backupRequest: BackupRequest) {
      this.eventTimestamp = new Date();
      this.backupRequest = backupRequest;
   }

   getAggregateId(): UniqueIdentifier {
      return this.backupRequest.id;
   }
}