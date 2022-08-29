import { UseCase } from '../../../common/application/UseCase';
import { Result, ok, err } from '../../../common/core/Result';
import { Guard } from '../../../common/core/Guard';

import { Backup, IBackupProps } from '../../../backup/domain/Backup';
import { IBackupRepo } from '../../../backup/adapter/BackupRepo';
import { IBackupJobServiceAdapter } from '../../../backup-job/adapter/BackupJobServiceAdapter';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';
import * as DomainErrors from '../../../common/domain/DomainErrors';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';

import { IBackupRequestRepo } from '../../adapter/IBackupRequestRepo';
import { BackupRequest } from '../../domain/BackupRequest';
import { StoreResultTypeValues, validStoreResultTypes } from '../../domain/StoreResultType';
import { StoreStatusReplyDTO } from './StoreStatusReplyDTO';
import { RequestStatusTypeValues } from '../../domain/RequestStatusType';

// add errors when you define them
type Response = Result<
	BackupRequest,
	DomainErrors.PropsError | AdapterErrors.BackupJobServiceError | AdapterErrors.DatabaseError | Error
>;

/**
 * Class representing a use case to create a new backup request and store it in the request log
 */
export class ReceiveStoreStatusReplyUseCase implements UseCase<StoreStatusReplyDTO, Promise<Response>> {
	private backupRequestRepo: IBackupRequestRepo;
	private backupRepo: IBackupRepo;
	private backupJobServiceAdapter: IBackupJobServiceAdapter;

	constructor(inject: {
		backupRequestRepo: IBackupRequestRepo;
		backupRepo: IBackupRepo;
		backupJobServiceAdapter: IBackupJobServiceAdapter;
	}) {
		this.backupRequestRepo = inject.backupRequestRepo;
		this.backupRepo = inject.backupRepo;
		this.backupJobServiceAdapter = inject.backupJobServiceAdapter;
	}

	async execute(reply: StoreStatusReplyDTO): Promise<Response> {
		// // console.log('RSSRUC start', reply);
		const { resultTypeCode, backupRequestId, ...restOfReply } = reply;

		const resultTypeCodeGuardResult = Guard.isOneOf(resultTypeCode, validStoreResultTypes, 'resultTypeCode');
		if (resultTypeCodeGuardResult.isErr()) {
			return err(new DomainErrors.PropsError(`{ message: ${resultTypeCodeGuardResult.error.message}}`));
		}

		const backupRequestIdGuardResult = Guard.againstNullOrUndefined(backupRequestId, 'backupRequestId');
		if (backupRequestIdGuardResult.isErr()) {
			return err(new DomainErrors.PropsError(`{ message: ${backupRequestIdGuardResult.error.message}}`));
		}

		// console.log('RSSRUC get backup request');
		// backup request must exist or we can't do anything
		const backupRequestResult = await this.backupRequestRepo.getById(backupRequestId);
		if (backupRequestResult.isErr()) {
			return backupRequestResult;
		}
		const backupRequest = backupRequestResult.value;

		// console.log('RSSRUC get backup job');
		// backup job must exist or we can't do anything
		const backupJobResult = await this.backupJobServiceAdapter.getById(backupRequest.backupJobId.value);
		if (backupJobResult.isErr()) {
			return err(backupJobResult.error);
		}
		const backupJob = backupJobResult.value;

		// console.log('RSSRUC get backup');
		// get any existing Backup for this BackupRequest
		const existingBackupResult = await this.backupRepo.getByBackupRequestId(backupRequestId);

		// console.log('RSSRUC existingBackupResult', existingBackupResult);

		// If an error isn't a NotFoundError, fail the use case -- it's probably a DatabaseError, but use !== 'NotFoundError' so nothing slips through
		if (existingBackupResult.isErr() && existingBackupResult.error.name !== 'NotFoundError') {
			return err(existingBackupResult.error);
		}

		let backup: Backup = {} as Backup;
		if (existingBackupResult.isOk()) {
			backup = existingBackupResult.value;
		} else if (resultTypeCode === StoreResultTypeValues.Succeeded) {
			// Any isErr() that makes it here it must be NotFoundError -- create and save the backup
			// console.log('RSSRUC creating Backup');

			// create backup aggregate from data in request, reply, and job
			const requestProps: IBackupProps = {
				backupRequestId: new UniqueIdentifier(backupRequestId),
				dataDate: backupRequest.dataDate,
				backupProviderCode: backupRequest.backupProviderCode,
				backupJobId: backupJob.backupJobId,
				daysToKeepCount: backupJob.daysToKeep,
				holdFlag: backupJob.holdFlag,
				...restOfReply,
			};

			const backupCreateResult = Backup.create(requestProps);
			if (backupCreateResult.isErr()) {
				return backupCreateResult as unknown as Response;
			}

			backup = backupCreateResult.value;

			// save the backup aggregate
			const backupSaveResult = await this.backupRepo.save(backup);
			if (backupSaveResult.isErr()) {
				return err(backupSaveResult.error);
			}
		}

		// I'm using the strategy below because it makes the conditions that result in
		// backupRequest changes and saves clearer than a complex if/else structure (IMO)
		const backupFound = existingBackupResult.isOk();
		let shouldSaveBackupRequest = false;

		if (backupFound && !backupRequest.isSucceeded()) {
			// if we have a Backup and it isn't Succeeded, it should be no matter what the store status, so make it so
			backupRequest.setStatusReplied(RequestStatusTypeValues.Succeeded, reply.messageText);
			shouldSaveBackupRequest = true;
		}
		if (!backupFound && resultTypeCode === StoreResultTypeValues.Succeeded) {
			// backup was saved, request is Succeeded -- period, end of discussion
			backupRequest.setStatusReplied(RequestStatusTypeValues.Succeeded, reply.messageText);
			shouldSaveBackupRequest = true;
		}
		if (!backupFound && resultTypeCode === StoreResultTypeValues.Failed && !backupRequest.isFailed()) {
			backupRequest.setStatusReplied(RequestStatusTypeValues.Failed, reply.messageText);
			shouldSaveBackupRequest = true;
		}

		if (shouldSaveBackupRequest) {
			const backupRequestSaveResult = await this.backupRequestRepo.save(backupRequest);
			if (backupRequestSaveResult.isErr()) {
				return backupRequestSaveResult;
			}
		}

		return ok(backupRequest);
	}
}
