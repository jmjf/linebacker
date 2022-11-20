import { UseCase } from '../../../common/application/UseCase';
import { Result, ok, err } from '../../../common/core/Result';
import { Guard } from '../../../common/core/Guard';
import { BaseError } from '../../../common/core/BaseError';

import { Backup, IBackupProps } from '../../../backup/domain/Backup';
import { IBackupRepo } from '../../../backup/adapter/IBackupRepo';
import { IBackupJobServiceAdapter } from '../../../backup-job/adapter/BackupJobServiceAdapter';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';
import * as DomainErrors from '../../../common/domain/DomainErrors';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';

import { IBackupRequestRepo } from '../../adapter/IBackupRequestRepo';
import { BackupRequest } from '../../domain/BackupRequest';
import { StoreResultTypeValues, validStoreResultTypes } from '../../domain/StoreResultType';
import { StoreStatusReplyDTO } from './StoreStatusReplyDTO';
import { BackupRequestStatusTypeValues } from '../../domain/BackupRequestStatusType';

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);

// add errors when you define them
type Response = Result<
	BackupRequest,
	DomainErrors.PropsError | AdapterErrors.BackupJobServiceError | AdapterErrors.DatabaseError | BaseError
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
		const functionName = 'execute';
		// // console.log('RSSRUC start', reply);
		const { resultTypeCode, backupRequestId, ...restOfReply } = reply;

		const resultTypeCodeGuardResult = Guard.isOneOf(resultTypeCode, validStoreResultTypes, 'resultTypeCode');
		if (resultTypeCodeGuardResult.isErr()) {
			return err(
				new DomainErrors.PropsError(resultTypeCodeGuardResult.error.message, {
					argName: resultTypeCodeGuardResult.error.argName,
					moduleName,
					functionName,
				})
			);
		}

		const backupRequestIdGuardResult = Guard.againstNullOrUndefined(backupRequestId, 'backupRequestId');
		if (backupRequestIdGuardResult.isErr()) {
			return err(
				new DomainErrors.PropsError(backupRequestIdGuardResult.error.message, {
					argName: backupRequestIdGuardResult.error.argName,
					moduleName,
					functionName,
				})
			);
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

		// I'm writing the conditions as below because it makes the conditions that result in
		// backupRequest changes and saves clearer than a complex if/else structure (IMO)
		const backupFound = existingBackupResult.isOk();
		let shouldSaveBackupRequest = false;

		if (backupFound && !backupRequest.isSucceeded()) {
			// if we have a Backup and it isn't Succeeded, it should be no matter what the store status, so make it so
			backupRequest.setStatusReplied(BackupRequestStatusTypeValues.Succeeded, reply.messageText);
			shouldSaveBackupRequest = true;
		}
		if (!backupFound && resultTypeCode === StoreResultTypeValues.Succeeded) {
			// backup was saved, request is Succeeded -- period, end of discussion
			backupRequest.setStatusReplied(BackupRequestStatusTypeValues.Succeeded, reply.messageText);
			shouldSaveBackupRequest = true;
		}
		if (!backupFound && resultTypeCode === StoreResultTypeValues.Failed && !backupRequest.isFailed()) {
			backupRequest.setStatusReplied(BackupRequestStatusTypeValues.Failed, reply.messageText);
			shouldSaveBackupRequest = true;
		}

		//
		// An alternative approach that writes status based on the interface's result. If the interface
		// sends two contradictory results for a request, the BackupRequest's status could end up out of
		// sync with Backups. This case should not happen, but if it does, the inconsistency is possible.
		// The inconsistency should be a Backup exists for a request that is in Failed status because:
		// * A Succeeds result writes a Backup if none exists before it updates the request status.
		// * A Failed result will not delete a Backup that exists.
		//
		// The advantage of this approach is that request status always matches the last status received
		// from the interface.
		// The disadvantage of this approach is that request status may be inconsistent with Backups.
		//

		// const requestStatus = resultTypeCode === StoreResultTypeValues.Succeeded ? RequestStatusTypeValues.Succeeded : RequestStatusTypeValues.Failed;
		// backupRequest.setStatusReplied(requestStatus, reply.messageText);

		if (shouldSaveBackupRequest) {
			const backupRequestSaveResult = await this.backupRequestRepo.save(backupRequest);
			if (backupRequestSaveResult.isErr()) {
				return backupRequestSaveResult;
			}
		}

		return ok(backupRequest);
	}
}
