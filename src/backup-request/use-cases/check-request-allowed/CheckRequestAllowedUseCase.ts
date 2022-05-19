import { Result, ok, err } from '../../../common/core/Result';
import { UseCase } from '../../../common/application/UseCase';
import * as ApplicationErrors from '../../../common/application/ApplicationErrors';

import { IBackupJobServiceAdapter } from '../../../backup/adapter/BackupJobServiceAdapter';
import { BackupJob } from '../../../backup/domain/BackupJob';
import { IBackupRequestRepo } from '../../adapter/BackupRequestRepo';
import { BackupRequest } from '../../domain/BackupRequest';
import { RequestStatusTypeValues } from '../../domain/RequestStatusType';
import { CheckRequestAllowedDTO } from './CheckRequestAllowedDTO';


type Response = Result<BackupRequest, 
   ApplicationErrors.BackupRequestStatusError
   | ApplicationErrors.UnexpectedError
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

      const backupRequestOrError = await this.backupRequestRepo.getById(backupRequestId);
      if (backupRequestOrError.isErr()) {
         return backupRequestOrError;
      }
      const backupRequest = backupRequestOrError.value;

      // Already past this state
      if (backupRequest.isChecked() || backupRequest.isSentToInterface() || backupRequest.isReplied()) {
         return ok(backupRequest);
      }

      if (backupRequest.statusTypeCode !== RequestStatusTypeValues.Received) {
         return err(new ApplicationErrors.BackupRequestStatusError(`{ message: 'Must be in Received status', backupRequestId: '${backupRequestId}', statusTypeCode: '${backupRequest.statusTypeCode}'`));
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
      return await this.backupRequestRepo.save(backupRequest);
   }
}