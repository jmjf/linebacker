import { Result, err } from '../../../common/core/Result';
import { UseCase } from '../../../common/application/UseCase';
import * as ApplicationErrors from '../../../common/application/ApplicationErrors';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';

import { IBackupJobServiceAdapter } from '../../../backup-job/adapter/BackupJobServiceAdapter';
import { IBackupRequestRepo } from '../../adapter/IBackupRequestRepo';
import { BackupRequest } from '../../domain/BackupRequest';
import { CheckRequestAllowedDTO } from './CheckRequestAllowedDTO';

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);

type Response = Result<
	BackupRequest,
	ApplicationErrors.BackupRequestStatusError | ApplicationErrors.UnexpectedError | AdapterErrors.BackupJobServiceError
>;

export class CheckRequestAllowedUseCase implements UseCase<CheckRequestAllowedDTO, Promise<Response>> {
	private backupRequestRepo: IBackupRequestRepo;
	private backupJobServiceAdapter: IBackupJobServiceAdapter;

	constructor(injected: { backupRequestRepo: IBackupRequestRepo; backupJobServiceAdapter: IBackupJobServiceAdapter }) {
		this.backupRequestRepo = injected.backupRequestRepo;
		this.backupJobServiceAdapter = injected.backupJobServiceAdapter;
	}

	public async execute(request: CheckRequestAllowedDTO): Promise<Response> {
		const functionName = 'execute';
		// Get request from repository (returns a BackupRequest)
		const { backupRequestId } = request;

		const backupRequestResult = await this.backupRequestRepo.getById(backupRequestId);
		if (backupRequestResult.isErr()) {
			return backupRequestResult;
		}
		const backupRequest = backupRequestResult.value;

		// Already past this state
		if (!backupRequest.isReceived()) {
			return err(
				new ApplicationErrors.BackupRequestStatusError('Request must be in Received status', {
					backupRequestId,
					statusTypeCode: backupRequest.statusTypeCode,
					moduleName,
					functionName,
				})
			);
		}

		// Get backup job data
		const backupJobResult = await this.backupJobServiceAdapter.getById(
			backupRequest.backupJobId.value,
			backupRequestId // for logging
		);
		if (backupJobResult.isErr()) {
			return err(backupJobResult.error); // avoid a type error (BackupJob)
		}
		const backupJob = backupJobResult.value;

		// set status based on allowed rules
		const isAllowed = backupJob.isAllowed();
		backupRequest.setStatusChecked(isAllowed);
		if (isAllowed) {
			backupRequest.backupProviderCode = backupJob.backupProviderCode;
			backupRequest.storagePathName = backupJob.storagePathName;
			// the interface is responsible to apply its rules to any path prefixes and suffixes
		}

		// Update request in repo
		return await this.backupRequestRepo.save(backupRequest);
	}
}
