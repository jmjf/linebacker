import { err, ok, Result } from '../../../common/core/Result';
import * as InfrastructureErrors from '../../../common/infrastructure/InfrastructureErrors';
import { IEventBus } from '../../../common/infrastructure/event-bus/IEventBus';
import * as DomainErrors from '../../../common/domain/DomainErrors';
import { UseCase } from '../../../common/application/UseCase';

import { BackupRequest, IBackupRequestProps } from '../../domain/BackupRequest';
import { RequestTransportType } from '../../domain/RequestTransportType';
import { BackupRequestStatusTypeValues } from '../../domain/BackupRequestStatusType';
import { BackupRequestAccepted } from '../../domain/BackupRequestAccepted.event';
import path from 'node:path';

const moduleName = path.basename(module.filename);

export interface AcceptBackupRequestDTO {
	backupJobId: string; // UUIDv4
	dataDate: string; // yyyy-mm-dd
	backupDataLocation: string;
	transportType: string; // HTTP or Queue
	getOnStartFlag: boolean;
	requesterId?: string;
}

// add errors when you define them
type Response = Result<BackupRequest, DomainErrors.PropsError | InfrastructureErrors.EventBusError>;

export class AcceptBackupRequestUseCase implements UseCase<AcceptBackupRequestDTO, Promise<Response>> {
	private eventBus: IEventBus;

	constructor(backupRequestEventBus: IEventBus) {
		this.eventBus = backupRequestEventBus;
	}

	async execute(request: AcceptBackupRequestDTO): Promise<Response> {
		// initialize props
		const requestProps: IBackupRequestProps = {
			backupJobId: request.backupJobId,
			dataDate: request.dataDate,
			preparedDataPathName: request.backupDataLocation,
			getOnStartFlag: request.getOnStartFlag,
			transportTypeCode: request.transportType as RequestTransportType,
			statusTypeCode: BackupRequestStatusTypeValues.Accepted,
			acceptedTimestamp: new Date(),
			requesterId: request.requesterId,
		};

		// get a new BackupRequest (or handle error)
		const backupRequestResult = BackupRequest.create(requestProps);
		if (backupRequestResult.isErr()) {
			return backupRequestResult; // already an Err, so don't need err() wrapper
		}

		const acceptedEvent = new BackupRequestAccepted(backupRequestResult.value);
		const publishResult = await this.eventBus.publishEvent(acceptedEvent);
		if (publishResult.isErr()) {
			return err(publishResult.error);
		}

		return ok(backupRequestResult.value);
	}
}
