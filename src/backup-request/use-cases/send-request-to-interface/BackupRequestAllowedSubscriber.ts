import { log } from '../../../common/adapter/logger';
import { DomainEventBus, IDomainEventSubscriber } from '../../../common/domain/DomainEventBus';
import { BackupRequestAllowed } from '../../domain/BackupRequestAllowed';
import { SendRequestToInterfaceUseCase } from './SendRequestToInterfaceUseCase';

export class BackupRequestAllowedSubscriber implements IDomainEventSubscriber<BackupRequestAllowed> {
   private sendRequestToInterfaceUseCase: SendRequestToInterfaceUseCase;

   constructor(sendRequestToInterfaceUseCase: SendRequestToInterfaceUseCase) {
      this.setupSubscriptions();
      this.sendRequestToInterfaceUseCase = sendRequestToInterfaceUseCase;
   }

   setupSubscriptions(): void {
      DomainEventBus.subscribe(BackupRequestAllowed.name, this.onBackupRequestAllowed.bind(this));
   }

   async onBackupRequestAllowed(event: BackupRequestAllowed): Promise<void> {
      const backupRequest = event.backupRequest;
      const eventName = event.constructor.name;
      log.debug(`{_time: '${(new Date()).toUTCString()}, message: 'onBackupRequestAllowed started'`);

      try {
         const res = await this.sendRequestToInterfaceUseCase.execute({ backupRequestId: backupRequest.backupRequestId.value });
         log.info(`{_time: '${(new Date()).toUTCString()}', message: 'execute use case succeded', domainEvent: '${eventName}', res: ${JSON.stringify(res)}}`);
      } catch (e) {
         const err = e as Error;
         log.error(`{_time: '${(new Date()).toUTCString()}', message: 'execute use case failed', domainEvent: '${eventName}', error: '${err.message}'}`);
      }
   }
}