import { UseCase } from '../../../common/application/UseCase';
import { Result, ok, err } from '../../../common/core/Result';
import { Guard } from '../../../common/core/Guard';

import { Backup, IBackupProps } from '../../../backup/domain/Backup';
import { IBackupRepo } from '../../../backup/adapter/BackupRepo';
import { IBackupJobServiceAdapter } from '../../../backup/adapter/BackupJobServiceAdapter';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';
import * as DomainErrors from '../../../common/domain/DomainErrors';

import { IBackupRequestRepo } from '../../adapter/BackupRequestRepo';
import { BackupRequest } from '../../domain/BackupRequest';
import { BackupResultType, BackupResultTypeValues, validBackupResultTypes } from '../../domain/BackupResultType';
import { CreateBackupReplyDTO } from './CreateBackupReplyDTO';



// add errors when you define them
type Response = Result<Backup | BackupRequest, 
	DomainErrors.PropsError 
	| AdapterErrors.BackupJobServiceError
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

		// don't change already replied values
		if (backupRequest.isReplied()) {
			return ok(backupRequest);
		}

		// wait to save changes until the end in case Backup create fails
		backupRequest.setStatusReplied(resultTypeCode as BackupResultType, reply.messageText);

		let backup: Backup = {} as Backup;
		if (resultTypeCode === BackupResultTypeValues.Succeeded) {
			// backup job must exist or we can't do anything
			const backupJobResult = await this.backupJobServiceAdapter.getBackupJob(backupRequest.backupJobId.value);
			if (backupJobResult.isErr()) {
				return err(backupJobResult.error);
			}
			const backupJob = backupJobResult.value;

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

			const backupOrError = Backup.create(requestProps);
			if (backupOrError.isErr()) {
				return backupOrError;
			}

			backup = backupOrError.value;

			// save backup aggregate
			await this.backupRepo.save(backup);
		}

		// save backup request aggregate -- keep this save adjacent to backup aggregate save
		await this.backupRequestRepo.save(backupRequest);

		return ok(resultTypeCode === BackupResultTypeValues.Succeeded
			? backup
			: backupRequest
		);

	}
}