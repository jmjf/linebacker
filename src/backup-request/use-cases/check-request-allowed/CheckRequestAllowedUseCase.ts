import { UseCase } from '../../../common/application/UseCase';
import { Result, ok, err } from '../../../common/core/Result';
import { IBackupJobServiceAdapter } from '../../../backup/adapter/BackupJobServiceAdapter';
import { BackupJob } from '../../../backup/domain/BackupJob';
import { IBackupRequestRepo } from '../../adapter/BackupRequestRepo';
import { BackupRequest } from '../../domain/BackupRequest';
import { RequestStatusTypeValues } from '../../domain/RequestStatusType';
import { CheckRequestAllowedDTO } from './CheckRequestAllowedDTO';
import * as CheckRequestAllowedErrors from './CheckRequestAllowedErrors';


type Response = Result<BackupRequest, 
   CheckRequestAllowedErrors.NotInReceivedStatusError
   | Error>

export class CheckRequestAllowedUseCase implements UseCase<CheckRequestAllowedDTO, Promise<Response>> {

   private backupRequestRepo: IBackupRequestRepo;
   private backupJobServiceAdapter: IBackupJobServiceAdapter;

   constructor (injected: {backupRequestRepo: IBackupRequestRepo, backupJobServiceAdapter: IBackupJobServiceAdapter}) {
     this.backupRequestRepo = injected.backupRequestRepo;
     this.backupJobServiceAdapter = injected.backupJobServiceAdapter;
   }

   public async execute(request: CheckRequestAllowedDTO): Promise<Response> {
      // Get request from repository (returns a BackupRequest)
      const { backupRequestId } = request;

      let backupRequest: BackupRequest;
      try {
         backupRequest = await this.backupRequestRepo.getById(backupRequestId);
      } catch(e) {
         return err(e as Error);
      }

      // Already past this state
      if (backupRequest.isChecked() || backupRequest.isSentToInterface() || backupRequest.isReplied()) {
         return ok(backupRequest);
      }

      if (backupRequest.statusTypeCode !== RequestStatusTypeValues.Received) {
         return err(new CheckRequestAllowedErrors.NotInReceivedStatusError(`{ message: 'BackupRequest not in received status', backupRequestId: '${backupRequestId}', statusTypeCode: '${backupRequest.statusTypeCode}'`));
      }
      
      // Get backup job data
      let backupJob: BackupJob;
      try {
         backupJob = await this.backupJobServiceAdapter.getBackupJob(backupRequest.backupJobId.value);
      } catch(e) {
         return err(e as Error);
      }

      // set status based on allowed rules
      const isAllowed = backupJob.isAllowed();
      backupRequest.setStatusChecked(isAllowed);
      if (isAllowed) {
         backupRequest.backupProviderCode = backupJob.backupProviderCode;
         backupRequest.storagePathName = backupJob.storagePathName;
         // the interface is responsible to apply its rules to any path prefixes and suffixes
      }

      // Update request in repo
      await this.backupRequestRepo.save(backupRequest);
      // return left(Result.fail(backupRequest.toJSON())); // force fail for initial test
      return ok(backupRequest);
   }
}