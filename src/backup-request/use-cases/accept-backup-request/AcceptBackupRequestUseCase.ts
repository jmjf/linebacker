import { err, Result } from '../../../common/core/Result';
import { BaseError } from '../../../common/core/BaseError';
import * as DomainErrors from '../../../common/domain/DomainErrors';
import { UseCase } from '../../../common/application/UseCase';
import * as ApplicationErrors from '../../../common/application/ApplicationErrors';
import { IMessageBusAdapter } from '../../../common/messaging/IMessageBusAdapter';

import { BackupRequest, IBackupRequestProps } from '../../domain/BackupRequest';
import { RequestTransportType } from '../../domain/RequestTransportType';
import { RequestStatusTypeValues } from '../../domain/RequestStatusType';
import path from 'node:path';
import { KBackupRequestAccepted } from '../../domain/KBackupRequestAccepted';
import { ok } from 'node:assert';

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
type Response = Result<BackupRequest, DomainErrors.PropsError | ApplicationErrors.UnexpectedError | BaseError>;

export class AcceptBackupRequestUseCase implements UseCase<AcceptBackupRequestDTO, Promise<Response>> {
	private _messageBus: IMessageBusAdapter;

	constructor(messageBus: IMessageBusAdapter) {
		this._messageBus = messageBus;
	}

	// TODO externalize this

	getMessage(request: BackupRequest) {
		return new KBackupRequestAccepted(request);
	}

	async execute(request: AcceptBackupRequestDTO): Promise<Response> {
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

		// backupRequestResult type guarded by isErr() above
		const publishResult = await this._messageBus.publish(this.getMessage(backupRequestResult.value));
		if (publishResult.isErr()) {
			return err(new ApplicationErrors.UnexpectedError('Publish error', publishResult.error));
		}

		return backupRequestResult; // ok
	}
}
