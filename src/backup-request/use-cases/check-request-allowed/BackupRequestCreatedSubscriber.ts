import { log } from '../../../common/adapter/logger';
import { DomainEventBus, IDomainEventSubscriber } from '../../../common/domain/DomainEventBus';
import { BackupRequestCreated } from '../../domain/BackupRequestCreated';
import { CheckRequestAllowedUseCase } from './CheckRequestAllowedUseCase';

export class BackupRequestCreatedSubscriber implements IDomainEventSubscriber<BackupRequestCreated> {
   private CheckRequestAllowedUseCase: CheckRequestAllowedUseCase;

   constructor(CheckRequestAllowedUseCase: CheckRequestAllowedUseCase) {
      this.setupSubscriptions();
      this.CheckRequestAllowedUseCase = CheckRequestAllowedUseCase;
   }

   setupSubscriptions(): void {
      DomainEventBus.subscribe(BackupRequestCreated.name, this.onBackupRequestCreated.bind(this));
   }

   private async onBackupRequestCreated(event: BackupRequestCreated): Promise<void> {
      const backupRequest = event.backupRequest;
      const eventName = event.constructor.name;
      log.debug(`{_time: '${(new Date()).toUTCString()}, message: 'onBackupRequestCreated started'`);

      try {
         const res = await this.CheckRequestAllowedUseCase.execute({ backupRequestId: backupRequest.backupRequestId.value });
         log.info(`{_time: '${(new Date()).toUTCString()}', message: 'execute use case succeded', domainEvent: '${eventName}', res: ${JSON.stringify(res)}}`);
      } catch (err) {
         log.error(`{_time: '${(new Date()).toUTCString()}', message: 'execute use case failed', domainEvent: '${eventName}'}`);
      }
   }
}