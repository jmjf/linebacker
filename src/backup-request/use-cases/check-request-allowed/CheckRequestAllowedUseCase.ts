import { UseCase } from '../../../common/application/UseCase';
import { Either, left, right } from '../../../common/domain/Either';
import { Result } from '../../../common/domain/Result';
import { IBackupJobServiceAdapter } from '../../../backup/adapter/BackupJobServiceAdapter';
import { BackupJob } from '../../../backup/domain/BackupJob';
import { IBackupRequestRepo } from '../../adapter/BackupRequestRepo';
import { BackupRequest } from '../../domain/BackupRequest';
import { RequestStatusTypeValues } from '../../domain/RequestStatusType';
import { CheckRequestAllowedDTO } from './CheckRequestAllowedDTO';


type Response = Either<Result<any>, Result<BackupRequest>>;

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
      } catch(err) {
         return left(Result.fail(`Backup request not found for request id ${backupRequestId}`));
      }

      // Already past this state
      if (backupRequest.isChecked() || backupRequest.isSentToInterface() || backupRequest.isReplied()) {
         return right(Result.succeed<BackupRequest>(backupRequest));
      }

      if (backupRequest.statusTypeCode !== RequestStatusTypeValues.Received) {
         return left(Result.fail(`Backup request is not in Received status backupRequestId: ${backupRequestId} statusTypeCode: ${backupRequest.statusTypeCode}`));
      }
      
      // Get backup job data
      let backupJob: BackupJob;
      try {
         backupJob = await this.backupJobServiceAdapter.getBackupJob(backupRequest.backupJobId.value);
      } catch(err) {
         return left(Result.fail(`Backup job not found for backupRequestId: ${backupRequestId} backupJobId: ${backupRequest.backupJobId}`));
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
      return right(Result.succeed(backupRequest));
   }
}