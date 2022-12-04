import { Result, ok, err } from '../../../common/core/Result';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';
import * as DomainErrors from '../../../common/domain/DomainErrors';
import { UseCase } from '../../../common/application/UseCase';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';
import { IEventBus } from '../../../common/infrastructure/event-bus/IEventBus';
import * as InfrastructureErrors from '../../../common/infrastructure/InfrastructureErrors';

import { IBackupRequestRepo } from '../../adapter/IBackupRequestRepo';
import { BackupRequest } from '../../domain/BackupRequest';
import { RequestTransportType } from '../../domain/RequestTransportType';
import { BackupRequestStatusType, BackupRequestStatusTypeValues } from '../../domain/BackupRequestStatusType';
import path from 'node:path';
import { BackupRequestReceived } from '../../domain/BackupRequestReceived.event';
import { Guard } from '../../../common/core/Guard';

const moduleName = path.basename(module.filename);

export interface ReceiveBackupRequestDTO {
	backupRequestId: string;
	backupJobId: string;
	dataDate: Date;
	preparedDataPathName: string;
	getOnStartFlag: boolean;
	transportTypeCode: RequestTransportType;
	statusTypeCode: BackupRequestStatusType;
	acceptedTimestamp: Date;
	requesterId: string;
}

// add errors when you define them
type Response = Result<
	BackupRequest,
	DomainErrors.PropsError | AdapterErrors.DatabaseError | InfrastructureErrors.EventBusError
>;

/**
 * Class representing a use case to create a new backup request and store it in the request log
 */
export class ReceiveBackupRequestUseCase implements UseCase<ReceiveBackupRequestDTO, Promise<Response>> {
	private backupRequestRepo: IBackupRequestRepo;
	private eventBus: IEventBus;

	constructor(backupRequestRepo: IBackupRequestRepo, eventBus: IEventBus) {
		this.backupRequestRepo = backupRequestRepo;
		this.eventBus = eventBus;
	}

	async execute(acceptedEvent: ReceiveBackupRequestDTO): Promise<Response> {
		const functionName = 'execute';

		const guardResult = Guard.againstNullOrUndefined(acceptedEvent.backupRequestId, 'backupRequestId');
		if (guardResult.isErr()) {
			return err(
				new DomainErrors.PropsError(guardResult.error.message, { event: acceptedEvent, moduleName, functionName })
			);
		}

		const getRequestResult = await this.backupRequestRepo.getById(acceptedEvent.backupRequestId);
		if (getRequestResult.isErr() && getRequestResult.error.name !== 'NotFoundError') {
			return getRequestResult;
		}

		if (getRequestResult.isOk()) {
			const backupRequest = getRequestResult.value;

			// backup result was found, so if not Received, past this step.
			if (!backupRequest.isReceived()) {
				return err(
					new DomainErrors.PropsError('invalid request status', {
						expectedStatusTypeCode: BackupRequestStatusTypeValues.Received,
						statusTypeCode: backupRequest.statusTypeCode,
						backupRequestId: backupRequest.backupRequestId.value,
						receivedTimestamp: backupRequest.receivedTimestamp,
						moduleName,
						functionName,
					})
				);
			}

			// found and in received status, publish only (no save)
			const publishResult = await this.eventBus.publishEvent(new BackupRequestReceived(backupRequest));
			if (publishResult.isErr()) {
				return err(publishResult.error);
			}
			return ok(backupRequest);
		}

		// not found -> create and save
		const { backupRequestId, ...props } = acceptedEvent;
		const createResult = BackupRequest.create(
			{
				...props,
				backupJobId: new UniqueIdentifier(props.backupJobId),
			},
			new UniqueIdentifier(backupRequestId)
		);
		if (createResult.isErr()) {
			return createResult;
		}
		const backupRequest = createResult.value;
		backupRequest.setStatusReceived();

		const brSaveResult = await this.backupRequestRepo.save(backupRequest);
		if (brSaveResult.isErr()) {
			return brSaveResult;
		}

		return ok(backupRequest);
	}
}
