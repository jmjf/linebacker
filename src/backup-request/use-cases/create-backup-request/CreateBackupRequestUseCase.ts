import { Result } from '../../../common/core/Result';
import { BaseError } from '../../../common/core/BaseError';
import * as DomainErrors from '../../../common/domain/DomainErrors';
import { UseCase } from '../../../common/application/UseCase';
import * as ApplicationErrors from '../../../common/application/ApplicationErrors';

import { CreateBackupRequestDTO } from './CreateBackupRequestDTO';
import { IBackupRequestRepo } from '../../adapter/IBackupRequestRepo';
import { BackupRequest, IBackupRequestProps } from '../../domain/BackupRequest';
import { RequestTransportType } from '../../domain/RequestTransportType';
import { RequestStatusTypeValues } from '../../domain/RequestStatusType';
import path from 'node:path';

const moduleName = path.basename(module.filename);

// add errors when you define them
type Response = Result<BackupRequest, DomainErrors.PropsError | ApplicationErrors.UnexpectedError | BaseError>;

/**
 * Class representing a use case to create a new backup request and store it in the request log
 */
export class CreateBackupRequestUseCase implements UseCase<CreateBackupRequestDTO, Promise<Response>> {
	private backupRequestRepo: IBackupRequestRepo;

	constructor(backupRequestRepo: IBackupRequestRepo) {
		this.backupRequestRepo = backupRequestRepo;
	}

	async execute(request: CreateBackupRequestDTO): Promise<Response> {
		// initialize props
		const requestProps: IBackupRequestProps = {
			backupJobId: request.backupJobId,
			dataDate: request.dataDate,
			preparedDataPathName: request.backupDataLocation,
			getOnStartFlag: request.getOnStartFlag,
			transportTypeCode: request.transportType as RequestTransportType,
			statusTypeCode: RequestStatusTypeValues.Received,
			receivedTimestamp: new Date(),
			requesterId: request.requesterId,
		};

		// get a new BackupRequest (or handle error)
		const backupRequestResult = BackupRequest.create(requestProps);
		if (backupRequestResult.isErr()) {
			return backupRequestResult; // already an Err, so don't need err() wrapper
		}

		// type guarded by isErr() above
		return await this.backupRequestRepo.save(backupRequestResult.value);
	}
}
