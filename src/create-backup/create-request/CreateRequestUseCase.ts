import { UseCase } from '../../common/application/UseCase';
import { Result } from '../../common/domain/Result';
import { Either, left, right } from '../../common/domain/Either';
import { CreateRequestDTO } from './CreateRequestDTO';
import { IBackupRequestRepo } from '../adapter/BackupRequestRepo';
import { BackupRequest, IBackupRequestProps } from '../domain/BackupRequest';
import { RequestTransportType, validRequestTransportTypes } from '../domain/RequestTransportType';
import { Guard } from '../../common/domain/Guard';

// add errors when you define them
type Response = Either<Result<any>, Result<BackupRequest>>;

/**
 * Class representing a use case to create a new backup request and store it in the request log
 */
export class CreateRequestUseCase
	implements UseCase<CreateRequestDTO, Promise<Response>>
{
	private backupRequestRepo: IBackupRequestRepo;

	constructor(backupRequestRepo: IBackupRequestRepo) {
		this.backupRequestRepo = backupRequestRepo;
	}

	async execute(request: CreateRequestDTO): Promise<Response> {

		// initialize props
		const requestProps: IBackupRequestProps = {
			backupJobId: request.backupJobId,
			dataDate: request.dataDate,
			preparedDataPathName: request.backupDataLocation,
			getOnStartFlag: request.getOnStartFlag,
			transportTypeCode: request.transportType as RequestTransportType,
			statusTypeCode: 'Received',
			receivedTimestamp: (new Date())
		};
		
		// get a new BackupRequest (or handle error)
		const backupRequestOrError = BackupRequest.create(requestProps);
		if (backupRequestOrError.isFailure) {
			return left(backupRequestOrError);
		}

		const backupRequest = backupRequestOrError.getValue();
		await this.backupRequestRepo.save(backupRequest);

		return right(Result.succeed<BackupRequest>(backupRequest));
	}
}
