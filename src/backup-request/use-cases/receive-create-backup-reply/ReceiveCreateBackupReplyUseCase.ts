import { UseCase } from '../../../common/application/UseCase';
import { Result, ok, err } from '../../../common/core/Result';
import { Guard } from '../../../common/core/Guard';

import { Backup, IBackupProps } from '../../../backup/domain/Backup';
import { IBackupRepo } from '../../../backup/adapter/BackupRepo';
import { IBackupJobServiceAdapter } from '../../../backup/adapter/BackupJobServiceAdapter';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';
import * as DomainErrors from '../../../common/domain/DomainErrors';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';

import { IBackupRequestRepo } from '../../adapter/BackupRequestRepo';
import { BackupRequest } from '../../domain/BackupRequest';
import { BackupResultType, BackupResultTypeValues, validBackupResultTypes } from '../../domain/BackupResultType';
import { CreateBackupReplyDTO } from './CreateBackupReplyDTO';



// add errors when you define them
type Response = Result<Backup | BackupRequest, 
	DomainErrors.PropsError 
	| AdapterErrors.BackupJobServiceError
	| AdapterErrors.DatabaseError
	| Error
>;

/**
 * Class representing a use case to create a new backup request and store it in the request log
 */
export class ReceiveCreateBackupReplyUseCase
	implements UseCase<CreateBackupReplyDTO, Promise<Response>>
{
	private backupRequestRepo: IBackupRequestRepo;
   private backupRepo: IBackupRepo;
	private backupJobServiceAdapter: IBackupJobServiceAdapter;

	constructor(inject: {backupRequestRepo: IBackupRequestRepo, backupRepo: IBackupRepo, backupJobServiceAdapter: IBackupJobServiceAdapter}) {
		this.backupRequestRepo = inject.backupRequestRepo;
		this.backupRepo = inject.backupRepo;
		this.backupJobServiceAdapter = inject.backupJobServiceAdapter;
	}

	async execute(reply: CreateBackupReplyDTO): Promise<Response> {
		const { resultTypeCode, backupRequestId, ...restOfReply } = reply;

		const resultTypeCodeGuardResult = Guard.isOneOf(resultTypeCode, validBackupResultTypes, 'resultTypeCode');
		if (resultTypeCodeGuardResult.isErr()) {
			return err(new DomainErrors.PropsError(`{ message: ${resultTypeCodeGuardResult.error.message}}`));
		}

		const backupRequestIdGuardResult = Guard.againstNullOrUndefined(backupRequestId, 'backupRequestId');
		if (backupRequestIdGuardResult.isErr()) {
			return err(new DomainErrors.PropsError(`{ message: ${backupRequestIdGuardResult.error.message}}`));
		}

      // backup request must exist or we can't do anything
      const backupRequestResult = await this.backupRequestRepo.getById(backupRequestId);
      if (backupRequestResult.isErr()) {
         return backupRequestResult;
      }
      const backupRequest = backupRequestResult.value;

		let backup: Backup = {} as Backup;
		
		// if request succeeded, do Backup stuff, otherwise, the request failed and no Backup is needed.
		if (resultTypeCode === BackupResultTypeValues.Succeeded) {
			// backup job must exist or we can't do anything
			const backupJobResult = await this.backupJobServiceAdapter.getBackupJob(backupRequest.backupJobId.value);
			if (backupJobResult.isErr()) {
				return err(backupJobResult.error);
			}
			const backupJob = backupJobResult.value;

			// get any existing Backup for this BackupRequest
			const existingBackupResult = await this.backupRepo.getByBackupRequestId(backupRequestId);
			
			// If an error isn't a NotFoundError, fail the use case -- it's probably a DatabaseError, but use !== 'NotFoundError' so nothing slips through
			if (existingBackupResult.isErr() && (existingBackupResult.error.name !== 'NotFoundError'))
			{
				return existingBackupResult;			
			}
			
			// Any isErr() that makes it here it must be NotFoundError -- create and save the backup
			if (existingBackupResult.isErr()) {
				// create backup aggregate from data in request, reply, and job
				const requestProps: IBackupProps = {
					backupRequestId: new UniqueIdentifier(backupRequestId),
					dataDate: backupRequest.dataDate,
					backupProviderCode: backupRequest.backupProviderCode,
					backupJobId: backupJob.backupJobId,
					daysToKeepCount: backupJob.daysToKeep,
					holdFlag: backupJob.holdFlag,
					...restOfReply
				};

				const backupCreateResult = Backup.create(requestProps);
				if (backupCreateResult.isErr()) {
					return backupCreateResult;
				}

				backup = backupCreateResult.value;

				// save the backup aggregate
				const backupSaveResult = await this.backupRepo.save(backup);
				if (backupSaveResult.isErr()) {
					return backupSaveResult;
				}
			} else { // must be isOk(), so get the Backup so we can return it (if succeeded)
				backup = existingBackupResult.value;
			}
		} // else request failed and backup is set to {}

		backupRequest.setStatusReplied(resultTypeCode as BackupResultType, reply.messageText);
		const backupRequestSaveResult = await this.backupRequestRepo.save(backupRequest);
		if (backupRequestSaveResult.isErr()) {
			return backupRequestSaveResult;
		}

		// if the request succeeded, return the Backup, otherwise return the BackupRequest
		return ok(resultTypeCode === BackupResultTypeValues.Succeeded
			? backup
			: backupRequest
		);
	}
}