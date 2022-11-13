import { Result } from '../../../common/core/Result';
import { BaseError } from '../../../common/core/BaseError';
import * as DomainErrors from '../../../common/domain/DomainErrors';
import { UseCase } from '../../../common/application/UseCase';
import * as ApplicationErrors from '../../../common/application/ApplicationErrors';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';

import { IBackupRequestRepo } from '../../adapter/IBackupRequestRepo';
import { BackupRequest, IBackupRequestProps } from '../../domain/BackupRequest';
import { RequestStatusTypeValues } from '../../domain/RequestStatusType';
import { KBackupRequestAcceptedData } from '../../domain/KBackupRequestAccepted';

// add errors when you define them
type Response = Result<BackupRequest, DomainErrors.PropsError | ApplicationErrors.UnexpectedError | BaseError>;

/**
 * Class representing a use case to create a new backup request and store it in the request log
 */
export class ReceiveBackupRequestUseCase implements UseCase<KBackupRequestAcceptedData, Promise<Response>> {
	private backupRequestRepo: IBackupRequestRepo;

	constructor(backupRequestRepo: IBackupRequestRepo) {
		this.backupRequestRepo = backupRequestRepo;
	}

	async execute(dto: KBackupRequestAcceptedData): Promise<Response> {
		// TODO check dto to ensure props are ok
		// TODO ensure dates are dates; convert if needed

		// initialize props
		const props: IBackupRequestProps = {
			backupJobId: dto.backupJobId,
			dataDate: dto.dataDate,
			preparedDataPathName: dto.preparedDataPathName,
			getOnStartFlag: dto.getOnStartFlag,
			transportTypeCode: dto.transportTypeCode,
			statusTypeCode: RequestStatusTypeValues.Received,
			receivedTimestamp: dto.receivedTimestamp,
			requesterId: dto.requesterId,
		};

		// TODO: create to accept a string or UniqueIdentifier and handle

		// get a new BackupRequest (or handle error)
		const backupRequestResult = BackupRequest.create(props, new UniqueIdentifier(dto.backupRequestId));
		if (backupRequestResult.isErr()) {
			return backupRequestResult; // already an Err, so don't need err() wrapper
		}

		// type guarded by isErr() above
		return await this.backupRequestRepo.save(backupRequestResult.value);
	}
}
