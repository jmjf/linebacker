import { UseCase } from '../../../common/application/UseCase';
import { Either, left, right } from '../../../common/domain/Either';
import { Result } from '../../../common/domain/Result';
import { IBackupRequestRepo } from '../../adapter/BackupRequestRepo';
import { IBackupRepo } from '../../adapter/BackupRepo';
import { Backup, IBackupProps } from '../../domain/Backup';
import { BackupResultType } from '../../domain/BackupResultType';
import { BackupStatusReplyDTO } from './BackupStatusReplyDTO';

// add errors when you define them
type Response = Either<Result<any>, Result<Backup>>;

/**
 * Class representing a use case to create a new backup request and store it in the request log
 */
export class CreateBackupRecordUseCase
	implements UseCase<BackupStatusReplyDTO, Promise<Response>>
{
	private backupRequestRepo: IBackupRequestRepo;
   private backupRepo: IBackupRepo;

	constructor(inject: {backupRequestRepo: IBackupRequestRepo, backupRepo: IBackupRepo}) {
		this.backupRequestRepo = inject.backupRequestRepo;
		this.backupRepo = inject.backupRepo;
	}

	async execute(reply: BackupStatusReplyDTO): Promise<Response> {

      // if reply.backupRequestId doesn't exist, fail

		// initialize props
		const requestProps: IBackupProps = {
			backupRequestId: reply.backupRequestId,
			storagePathName: reply.backupStorageLocation,
         resultTypeCode: reply.resultType as BackupResultType,
         backupByteCount: reply.backupBytes,
         copyStartTimestamp: reply.copyStartTimestamp,
         copyEndTimestamp: reply.copyEndTimestamp,
         verifyStartTimestamp: reply.verifyStartTimestamp,
         verifyEndTimestamp: reply.verifyEndTimestamp,
         verifyHashText: reply.verifiedHash
		};
		
      // get a new Backup (or handle error)
		const backupOrError = Backup.create(requestProps);
		if (backupOrError.isFailure) {
			return left(backupOrError);
		}

		const backup = backupOrError.getValue();

      // get backup job for request

      // create backup aggregate from data in request, reply, and job

      // save backup aggregate

		return right(Result.succeed<Backup>(backup));
	}
}