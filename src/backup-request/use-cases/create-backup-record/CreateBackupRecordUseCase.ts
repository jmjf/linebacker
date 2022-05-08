import { UseCase } from '../../../common/application/UseCase';
import { Either, left, right } from '../../../common/domain/Either';
import { Result } from '../../../common/domain/Result';
import { IBackupRequestRepo } from '../../adapter/BackupRequestRepo';
import { IBackupRepo } from '../../adapter/BackupRepo';
import { Backup, IBackupProps } from '../../domain/Backup';
import { BackupStatusReplyDTO } from './BackupStatusReplyDTO';
import { BackupRequest } from '../../domain/BackupRequest';
import { BackupJob } from '../../domain/BackupJob';
import { IBackupJobServiceAdapter } from '../../adapter/BackupJobServiceAdapter';
import { Guard } from '../../../common/domain/Guard';
import { BackupResultType, BackupResultTypeValues, validBackupResultTypes } from '../../domain/BackupResultType';

// add errors when you define them
type Response = Either<Result<any>, Result<Backup | BackupRequest>>;

/**
 * Class representing a use case to create a new backup request and store it in the request log
 */
export class CreateBackupRecordUseCase
	implements UseCase<BackupStatusReplyDTO, Promise<Response>>
{
	private backupRequestRepo: IBackupRequestRepo;
   private backupRepo: IBackupRepo;
	private backupJobServiceAdapter: IBackupJobServiceAdapter;

	constructor(inject: {backupRequestRepo: IBackupRequestRepo, backupRepo: IBackupRepo, backupJobServiceAdapter: IBackupJobServiceAdapter}) {
		this.backupRequestRepo = inject.backupRequestRepo;
		this.backupRepo = inject.backupRepo;
		this.backupJobServiceAdapter = inject.backupJobServiceAdapter;
	}

	async execute(reply: BackupStatusReplyDTO): Promise<Response> {
		const { resultTypeCode, ...restOfReply } = reply;

		const resultTypeCodeGuardResult = Guard.isOneOf(resultTypeCode, validBackupResultTypes, 'resultTypeCode');
		if (!resultTypeCodeGuardResult.isSuccess) {
			return left(Result.fail(`Backup result resultTypeCode is invalid ${resultTypeCode}`));
		}

      // backup request must exist or we can't do anything
		let backupRequest: BackupRequest;
      try {
         backupRequest = await this.backupRequestRepo.getById(reply.backupRequestId);
      } catch(err) {
         return left(Result.fail(`Backup request not found for request id ${reply.backupRequestId}`));
      }

		let backup: Backup = {} as Backup;
		if (resultTypeCode === BackupResultTypeValues.Succeeded) {
			// backup job must exist or we can't do anything
			let backupJob: BackupJob;
			try {
				backupJob = await this.backupJobServiceAdapter.getBackupJob(backupRequest.backupJobId);
			} catch (err) {
				return left(Result.fail(`Backup job not found for job id ${backupRequest.backupJobId}`));
			}

			

			// create backup aggregate from data in request, reply, and job
			const requestProps: IBackupProps = {
				...restOfReply,
				dataDate: backupRequest.dataDate,
				backupProviderCode: backupRequest.backupProviderCode,
				backupJobId: backupJob.backupJobId.value,
				daysToKeepCount: backupJob.daysToKeep,
				holdFlag: backupJob.holdFlag
			};

			const backupOrError = Backup.create(requestProps);
			if (backupOrError.isFailure) {
				return left(backupOrError);
			}

			backup = backupOrError.getValue();

      	// save backup aggregate
			await this.backupRepo.save(backup);
		}

		// eliminated invalid values at the top, so this is safe
		backupRequest.setStatusReplied(resultTypeCode as BackupResultType, reply.messageText);
		await this.backupRequestRepo.save(backupRequest);

		return right(resultTypeCode === BackupResultTypeValues.Succeeded
			? Result.succeed<Backup>(backup)
			: Result.succeed<BackupRequest>(backupRequest)
		);

	}
}