import { UseCase } from '../../../common/application/UseCase';
import { Either, left, right } from '../../../common/domain/Either';
import { Result } from '../../../common/domain/Result';
import { IBackupRequestBackupInterfaceAdapter } from '../../adapter/BackupRequestBackupInterfaceAdapter';
import { IBackupRequestRepo } from '../../adapter/BackupRequestRepo';
import { BackupRequest } from '../../domain/BackupRequest';
import { SendRequestToInterfaceDTO } from './SendRequestToInterfaceDTO';

type Response = Either<Result<any>, Result<BackupRequest>>;

export class SendRequestToInterfaceUseCase implements UseCase<SendRequestToInterfaceDTO, Promise<Response>> {

   private backupRequestRepo: IBackupRequestRepo;
   private backupInterfaceAdapter: IBackupRequestBackupInterfaceAdapter;

   constructor (deps: {backupRequestRepo: IBackupRequestRepo, backupInterfaceAdapater: IBackupRequestBackupInterfaceAdapter}) {
     this.backupRequestRepo = deps.backupRequestRepo;
     this.backupInterfaceAdapter = deps.backupInterfaceAdapater;
   }

   public async execute(request: SendRequestToInterfaceDTO): Promise<Response> {
      // Get request from repository (returns a `BackupRequest`)
      let backupRequest: BackupRequest;
      const { requestId } = request;

      try {
         backupRequest = await this.backupRequestRepo.getById(requestId);
      } catch(err) {
         return left(Result.fail(`Get backup request by id failed for request id ${requestId}`));
      }

      if (backupRequest.backupRequestId === undefined || backupRequest.backupRequestId === null) {
         return left(Result.fail(`Backup request not found for requestId ${requestId}`));
      }

      if (backupRequest.isSentToInterface()) {
         // NEED TO LOG
         return right(Result.succeed<BackupRequest>(backupRequest));
      }

      if (backupRequest.statusTypeCode !== 'Allowed') {
         return left(Result.fail(`Backup request is not in Allowed status requestId: ${requestId} statusTypeCode: ${backupRequest.statusTypeCode}`));
      }
      
      // Send request to backup store interface -- need to handle this better
      const sendOk = await this.backupInterfaceAdapter.sendMessage(backupRequest);
      if (!sendOk) {
         // LOG
         return left(Result.fail(`Could not send backup request to backup interface requestId: ${requestId}`));
      }

      // Set request status, status timestamp, etc.
      backupRequest.setStatusSent();
            
      // Update request in repo
      await this.backupRequestRepo.save(backupRequest);
      return right(Result.succeed(backupRequest));
   }
}