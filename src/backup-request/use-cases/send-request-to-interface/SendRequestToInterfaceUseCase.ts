import { UseCase } from '../../../common/application/UseCase';
import { Result, ok, err } from '../../../common/core/Result';
import * as ApplicationErrors from '../../../common/application/ApplicationErrors';

import { IBackupInterfaceStoreAdapter } from '../../adapter/IBackupInterfaceStoreAdapter';
import { IBackupRequestRepo } from '../../adapter/IBackupRequestRepo';
import { BackupRequest } from '../../domain/BackupRequest';
import { RequestStatusTypeValues } from '../../domain/RequestStatusType';
import { SendRequestToInterfaceDTO } from './SendRequestToInterfaceDTO';
import * as SendRequestToInterfaceErrors from './SendRequestToInterfaceErrors';

type Response = Result<
	BackupRequest,
	| ApplicationErrors.BackupRequestStatusError
	| SendRequestToInterfaceErrors.SendToInterfaceError
	| ApplicationErrors.UnexpectedError
	| Error
>;

export class SendRequestToInterfaceUseCase implements UseCase<SendRequestToInterfaceDTO, Promise<Response>> {
	private backupRequestRepo: IBackupRequestRepo;
	private interfaceStoreAdapter: IBackupInterfaceStoreAdapter;

	constructor(deps: { backupRequestRepo: IBackupRequestRepo; interfaceStoreAdapter: IBackupInterfaceStoreAdapter }) {
		this.backupRequestRepo = deps.backupRequestRepo;
		this.interfaceStoreAdapter = deps.interfaceStoreAdapter;
	}

	public async execute(request: SendRequestToInterfaceDTO): Promise<Response> {
		// Get request from repository (returns a `BackupRequest`)
		const { backupRequestId } = request;

		const backupRequestResult = await this.backupRequestRepo.getById(backupRequestId);
		if (backupRequestResult.isErr()) {
			return backupRequestResult;
		}
		const backupRequest = backupRequestResult.value;

		if (!backupRequest.isAllowed()) {
			return err(
				new ApplicationErrors.BackupRequestStatusError(
					`{ message: 'Must be in Allowed status', requestId: '${backupRequestId}', statusTypeCode: '${backupRequest.statusTypeCode}'`
				)
			);
		}

		// Send request to backup store interface -- need to handle this better
		const sendResult = await this.interfaceStoreAdapter.send(backupRequest);
		if (sendResult.isErr()) {
			// LOG
			return err(
				new SendRequestToInterfaceErrors.SendToInterfaceError(
					`{ message: 'Send to backup interface ${this.interfaceStoreAdapter.constructor.name} failed', requestId: '${backupRequestId}', error: '${sendResult.error.message}'`
				)
			);
		}
		if (sendResult.value.isSent === false) {
			// LOG
			return err(
				new SendRequestToInterfaceErrors.SendToInterfaceError(
					`{ message: 'Send to backup interface ${
						this.interfaceStoreAdapter.constructor.name
					} failed', backupRequestId: '${backupRequestId}', response: ${JSON.stringify(sendResult.value)}`
				)
			);
		}

		// Set request status, status timestamp, etc.
		backupRequest.setStatusSent();

		// Update request in repo
		return await this.backupRequestRepo.save(backupRequest);
	}
}
