import { UseCase } from '../../../common/application/UseCase';
import { Result, err } from '../../../common/core/Result';
import * as ApplicationErrors from '../../../common/application/ApplicationErrors';

import { IBackupInterfaceStoreAdapter } from '../../adapter/IBackupInterfaceStoreAdapter';
import { IBackupRequestRepo } from '../../adapter/IBackupRequestRepo';
import { BackupRequest } from '../../domain/BackupRequest';
import { SendRequestToInterfaceDTO } from './SendRequestToInterfaceDTO';

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);

type Response = Result<
	BackupRequest,
	| ApplicationErrors.BackupRequestStatusError
	| ApplicationErrors.SendToInterfaceError
	| ApplicationErrors.UnexpectedError
>;

export class SendRequestToInterfaceUseCase implements UseCase<SendRequestToInterfaceDTO, Promise<Response>> {
	private backupRequestRepo: IBackupRequestRepo;
	private interfaceStoreAdapter: IBackupInterfaceStoreAdapter;

	constructor(deps: { backupRequestRepo: IBackupRequestRepo; interfaceStoreAdapter: IBackupInterfaceStoreAdapter }) {
		this.backupRequestRepo = deps.backupRequestRepo;
		this.interfaceStoreAdapter = deps.interfaceStoreAdapter;
	}

	public async execute(request: SendRequestToInterfaceDTO): Promise<Response> {
		const functionName = 'execute';
		// Get request from repository (returns a `BackupRequest`)
		const { backupRequestId } = request;

		const backupRequestResult = await this.backupRequestRepo.getById(backupRequestId);
		if (backupRequestResult.isErr()) {
			return backupRequestResult;
		}
		const backupRequest = backupRequestResult.value;

		if (!backupRequest.isAllowed()) {
			return err(
				new ApplicationErrors.BackupRequestStatusError('Request must be in Allowed status', {
					backupRequestId,
					statusTypeCode: backupRequest.statusTypeCode,
					moduleName,
					functionName,
				})
			);
		}

		// Send request to backup store interface -- need to handle this better
		const sendResult = await this.interfaceStoreAdapter.send(backupRequest);
		if (sendResult.isErr()) {
			return err(sendResult.error);
		}
		if (sendResult.value.isSent === false) {
			return err(
				new ApplicationErrors.SendToInterfaceError(
					`Send to backup interface ${this.interfaceStoreAdapter.constructor.name} failed`,
					{ backupRequestId, resultValue: sendResult.value, moduleName, functionName }
				)
			);
		}

		// Set request status, status timestamp, etc.
		backupRequest.setStatusSent();

		// Update request in repo
		return await this.backupRequestRepo.save(backupRequest);
	}
}
