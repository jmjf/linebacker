import { UseCase } from '../../../common/application/UseCase';
import { Result, ok, err } from '../../../common/core/Result';
import { IBackupRequestBackupInterfaceAdapter } from '../../adapter/BackupRequestBackupInterfaceAdapter';
import { IBackupRequestRepo } from '../../adapter/BackupRequestRepo';
import { BackupRequest } from '../../domain/BackupRequest';
import { RequestStatusTypeValues } from '../../domain/RequestStatusType';
import { SendRequestToInterfaceDTO } from './SendRequestToInterfaceDTO';
import * as SendRequestToInterfaceErrors from './SendRequestToInterfaceErrors';

type Response = Result<BackupRequest, 
   SendRequestToInterfaceErrors.NotInAllowedStatusError
   | SendRequestToInterfaceErrors.SendToInterfaceFailedError
   | Error>;

export class SendRequestToInterfaceUseCase implements UseCase<SendRequestToInterfaceDTO, Promise<Response>> {

   private backupRequestRepo: IBackupRequestRepo;
   private backupInterfaceAdapter: IBackupRequestBackupInterfaceAdapter;

   constructor (deps: {backupRequestRepo: IBackupRequestRepo, backupInterfaceAdapter: IBackupRequestBackupInterfaceAdapter}) {
     this.backupRequestRepo = deps.backupRequestRepo;
     this.backupInterfaceAdapter = deps.backupInterfaceAdapter;
   }

   public async execute(request: SendRequestToInterfaceDTO): Promise<Response> {
      // Get request from repository (returns a `BackupRequest`)
      let backupRequest: BackupRequest;
      const requestId = request.backupRequestId;

      try {
         backupRequest = await this.backupRequestRepo.getById(requestId);
      } catch(e) {
         return err(e as Error);
      }

      if (backupRequest.isSentToInterface() || backupRequest.isReplied()) {
         // NEED TO LOG
         return ok(backupRequest);
      }

      if (backupRequest.statusTypeCode !== RequestStatusTypeValues.Allowed) {
         return err(new SendRequestToInterfaceErrors.NotInAllowedStatusError(`{ message: 'Not in allowed status', requestId: '${requestId}', statusTypeCode: '${backupRequest.statusTypeCode}'`));
      }
      
      // Send request to backup store interface -- need to handle this better
      const sendOk = await this.backupInterfaceAdapter.sendMessage(backupRequest);
      if (!sendOk) {
         // LOG
         return err(new SendRequestToInterfaceErrors.SendToInterfaceFailedError(`{ message: 'Send to backup interface ${this.backupInterfaceAdapter.constructor.name} failed', requestId: '${requestId}'`));
      }

      // Set request status, status timestamp, etc.
      backupRequest.setStatusSent();
            
      // Update request in repo
      await this.backupRequestRepo.save(backupRequest);
      return ok(backupRequest);
   }
}