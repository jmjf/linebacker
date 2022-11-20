import { Result, ok, err } from '../../../common/core/Result';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';
import * as DomainErrors from '../../../common/domain/DomainErrors';
import { UseCase } from '../../../common/application/UseCase';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';

import { IBackupRequestRepo } from '../../adapter/IBackupRequestRepo';
import { IBackupRequestEventBus } from '../../adapter/IBackupRequestEventBus';
import { BackupRequest } from '../../domain/BackupRequest';
import { RequestTransportType } from '../../domain/RequestTransportType';
import { RequestStatusType, RequestStatusTypeValues } from '../../domain/RequestStatusType';
import path from 'node:path';

const moduleName = path.basename(module.filename);

export interface ReceiveBackupRequestDTO {
	backupRequestId: string;
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
type Response = Result<
	BackupRequest,
	DomainErrors.PropsError | AdapterErrors.DatabaseError | AdapterErrors.EventBusError
>;

/**
 * Class representing a use case to create a new backup request and store it in the request log
 */
export class ReceiveBackupRequestUseCase implements UseCase<ReceiveBackupRequestDTO, Promise<Response>> {
	private backupRequestRepo: IBackupRequestRepo;
	private eventBus: IBackupRequestEventBus;

	constructor(backupRequestRepo: IBackupRequestRepo, eventBus: IBackupRequestEventBus) {
		this.backupRequestRepo = backupRequestRepo;
		this.eventBus = eventBus;
	}

	async execute(acceptedEvent: ReceiveBackupRequestDTO): Promise<Response> {
		const functionName = 'execute';

		let backupRequest: BackupRequest;

		const getRequestResult = await this.backupRequestRepo.getById(acceptedEvent.backupRequestId);
		if (getRequestResult.isErr() && getRequestResult.error.name !== 'NotFoundError') {
			return getRequestResult;
		}

		if (getRequestResult.isOk()) {
			backupRequest = getRequestResult.value;

			// existing request must be in Received status
			if (backupRequest.statusTypeCode !== RequestStatusTypeValues.Received) {
				return err(
					new DomainErrors.PropsError('invalid request status', {
						expectedStatusTypeCode: RequestStatusTypeValues.Received,
						statusTypeCode: backupRequest.statusTypeCode,
						backupRequestId: backupRequest.backupRequestId.value,
						moduleName,
						functionName,
					})
				);
			}
		} else {
			// not found -> create and save
			const { backupRequestId, ...props } = acceptedEvent;
			const createResult = BackupRequest.create(
				{ ...props, statusTypeCode: RequestStatusTypeValues.Received },
				new UniqueIdentifier(backupRequestId)
			);
			if (createResult.isErr()) {
				return createResult;
			}
			backupRequest = createResult.value;

			const brSaveResult = await this.backupRequestRepo.save(backupRequest);
			if (brSaveResult.isErr()) {
				return brSaveResult;
			}
		}

		const publishResult = await this.eventBus.publish('received-backup-requests', backupRequest);
		if (publishResult.isErr()) {
			return publishResult;
		}

		return ok(backupRequest as unknown as BackupRequest);
	}
}
