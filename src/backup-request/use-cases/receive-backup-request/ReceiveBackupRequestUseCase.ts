import { Result, ok } from '../../../common/core/Result';
import { BaseError } from '../../../common/core/BaseError';
import * as DomainErrors from '../../../common/domain/DomainErrors';
import { UseCase } from '../../../common/application/UseCase';
import * as ApplicationErrors from '../../../common/application/ApplicationErrors';

import { IBackupRequestRepo } from '../../adapter/IBackupRequestRepo';
import { BackupRequest, IBackupRequestProps } from '../../domain/BackupRequest';
import { RequestTransportType } from '../../domain/RequestTransportType';
import { RequestStatusType, RequestStatusTypeValues } from '../../domain/RequestStatusType';
import path from 'node:path';

const moduleName = path.basename(module.filename);

export interface ReceiveBackupRequestDTO {
	backupJobId: string;
	dataDate: Date;
	preparedDataPathName: string;
	getOnStartFlag: boolean;
	transportTypeCode: RequestTransportType;
	statusTypeCode: RequestStatusType;
	receivedTimestamp: Date;
	requesterId: string;
}

// add errors when you define them
type Response = Result<BackupRequest, DomainErrors.PropsError | ApplicationErrors.UnexpectedError | BaseError>;

/**
 * Class representing a use case to create a new backup request and store it in the request log
 */
export class ReceiveBackupRequestUseCase implements UseCase<ReceiveBackupRequestDTO, Promise<Response>> {
	private backupRequestRepo: IBackupRequestRepo;

	constructor(backupRequestRepo: IBackupRequestRepo) {
		this.backupRequestRepo = backupRequestRepo;
	}

	async execute(request: ReceiveBackupRequestDTO): Promise<Response> {
		// initialize props
		const requestProps: IBackupRequestProps = {
			backupJobId: request.backupJobId,
			dataDate: request.dataDate,
			preparedDataPathName: request.preparedDataPathName,
			getOnStartFlag: request.getOnStartFlag,
			transportTypeCode: request.transportTypeCode,
			statusTypeCode: request.statusTypeCode,
			receivedTimestamp: request.receivedTimestamp,
			requesterId: request.requesterId,
		};

		return ok(request as unknown as BackupRequest);

		// // get a new BackupRequest (or handle error)
		// const backupRequestResult = BackupRequest.create(requestProps);
		// if (backupRequestResult.isErr()) {
		// 	return backupRequestResult; // already an Err, so don't need err() wrapper
		// }

		// // type guarded by isErr() above
		// return await this.backupRequestRepo.save(backupRequestResult.value);
	}
}
