import { log } from '../../../common/adapter/logger';
import { DomainEventBus, IDomainEventSubscriber } from '../../../common/domain/DomainEventBus';
import { BackupRequestCreated } from '../../domain/BackupRequestCreated';
import { SendRequestToInterfaceUseCase } from './SendRequestToInterfaceUseCase';

export class BackupRequestCreatedSubscriber implements IDomainEventSubscriber<BackupRequestCreated> {
   private sendRequestToInterfaceUseCase: SendRequestToInterfaceUseCase;

   constructor(sendRequestToInterfaceUseCase: SendRequestToInterfaceUseCase) {
      this.setupSubscriptions();
      this.sendRequestToInterfaceUseCase = sendRequestToInterfaceUseCase;
   }

   setupSubscriptions(): void {
      DomainEventBus.subscribe(BackupRequestCreated.name, this.onBackupRequestCreated.bind(this));
   }

   private async onBackupRequestCreated(event: BackupRequestCreated): Promise<void> {
      const backupRequest = event.backupRequest;
      const eventName = event.constructor.name;

      try {
         await this.sendRequestToInterfaceUseCase.execute({ backupRequestId: backupRequest.backupRequestId.value });
         log.info(`{_time: '${(new Date()).toUTCString()}', message: 'execute use case succeded', domainEvent: '${eventName}'}`);
      } catch (err) {
         log.error(`{_time: '${(new Date()).toUTCString()}', message: 'execute use case failed', domainEvent: '${eventName}'}`);
      }
   }
}