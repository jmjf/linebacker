import { UseCase } from '../../../common/application/UseCase';
import { Result, ok, err } from '../../../common/core/Result';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';
import * as DomainErrors from '../../../common/domain/DomainErrors';

import { CreateRequestDTO } from './CreateRequestDTO';
import { IBackupRequestRepo } from '../../adapter/BackupRequestRepo';
import { BackupRequest, IBackupRequestProps } from '../../domain/BackupRequest';
import { RequestTransportType } from '../../domain/RequestTransportType';
import { RequestStatusTypeValues } from '../../domain/RequestStatusType';


// add errors when you define them
type Response = Result<BackupRequest, 
	DomainErrors.InvalidPropsError 
	| Error
>;

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
			backupJobId: new UniqueIdentifier(request.backupJobId),
			dataDate: request.dataDate,
			preparedDataPathName: request.backupDataLocation,
			getOnStartFlag: request.getOnStartFlag,
			transportTypeCode: request.transportType as RequestTransportType,
			statusTypeCode: RequestStatusTypeValues.Received,
			receivedTimestamp: (new Date())
		};
		
		// get a new BackupRequest (or handle error)
		const backupRequestOrError = BackupRequest.create(requestProps);
		if (backupRequestOrError.isErr()) {
			return backupRequestOrError; // already an Err, so don't need err() wrapper
		}

		// type guarded by isErr() above
		const backupRequest = backupRequestOrError.value;
		await this.backupRequestRepo.save(backupRequest);

		return ok(backupRequest);
	}
}
