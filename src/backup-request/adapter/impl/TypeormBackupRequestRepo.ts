import { TypeormBackupRequest } from '../../../typeorm/entity/TypeormBackupRequest.entity';
import { TypeormContext } from '../../../common/infrastructure/database/typeormContext';

import { err, ok, Result } from '../../../common/core/Result';
import { DomainEventBus } from '../../../common/domain/DomainEventBus';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';
import * as DomainErrors from '../../../common/domain/DomainErrors';

import { BackupProviderType } from '../../../backup-job/domain/BackupProviderType';

import { BackupRequest } from '../../domain/BackupRequest';
import { RequestTransportType } from '../../domain/RequestTransportType';
import { IBackupRequestRepo } from '../IBackupRequestRepo';

// use when deep testing
import { logger } from '../../../common/infrastructure/pinoLogger';

export class TypeormBackupRequestRepo implements IBackupRequestRepo {
	private typeormCtx: TypeormContext;

	constructor(typeormCtx: TypeormContext) {
		// Use TypeORM's EntityManager because I don't want to put my repo intelligence in
		// a TypeORM construct because doing so creates tight coupling to TypeORM.
		this.typeormCtx = typeormCtx;
	}

	public async exists(backupRequestId: string): Promise<Result<boolean, AdapterErrors.DatabaseError>> {
		// count the number of rows that meet the condition
		try {
			const count = await this.typeormCtx.manager.count(TypeormBackupRequest, {
				where: {
					backupRequestId: backupRequestId,
				},
			});

			return ok(count > 0);
		} catch (e) {
			return err(new AdapterErrors.DatabaseError(`${JSON.stringify(e)}`));
		}
	}

	public async getById(
		backupRequestId: string
	): Promise<
		Result<BackupRequest, AdapterErrors.DatabaseError | AdapterErrors.NotFoundError | DomainErrors.PropsError>
	> {
		try {
			const data = await this.typeormCtx.manager.findOne(TypeormBackupRequest, {
				where: {
					backupRequestId: backupRequestId,
				},
			});
			logger.info({ msg: 'Typeorm getById', data: data });

			if (data === null) {
				return err(new AdapterErrors.NotFoundError(`Backup request not found |${backupRequestId}|`));
			}

			return this.mapToDomain(data);
		} catch (e) {
			logger.error({ msg: 'Typeorm getById error', error: e });
			return err(new AdapterErrors.DatabaseError(`${JSON.stringify(e)}`));
		}
	}

	public async save(backupRequest: BackupRequest): Promise<Result<BackupRequest, AdapterErrors.DatabaseError>> {
		const raw = this.mapToDb(backupRequest);

		try {
			await this.typeormCtx.manager.save(TypeormBackupRequest, { ...raw });
		} catch (e) {
			logger.error({ msg: 'Typeorm save error', error: e });
			return err(new AdapterErrors.DatabaseError(`${JSON.stringify(e)}`));
		}

		// trigger domain events
		DomainEventBus.publishEventsForAggregate(backupRequest.id);

		// The application enforces the business rules, not the database.
		// Under no circumstances should the database change the data it gets.
		// Returning the backup request allows use cases to return the result of save() if they can't do anything about a DatabaseError.
		return ok(backupRequest);
	}

	// this may belong in a mapper
	private mapToDomain(raw: any): Result<BackupRequest, DomainErrors.PropsError> {
		const backupRequestId = new UniqueIdentifier(raw.backupRequestId);
		const backupRequestResult = BackupRequest.create(
			{
				backupJobId: new UniqueIdentifier(raw.backupJobId),
				dataDate: raw.dataDate,
				preparedDataPathName: raw.preparedDataPathName,
				getOnStartFlag: raw.getOnStartFlag,
				transportTypeCode: raw.transportTypeCode as RequestTransportType,
				backupProviderCode: raw.backupProviderCode as BackupProviderType,
				storagePathName: raw.storagePathName,
				statusTypeCode: raw.statusTypeCode,
				receivedTimestamp: raw.receivedTimestamp,
				checkedTimestamp: raw.checkedTimestamp,
				sentToInterfaceTimestamp: raw.sentToInterfaceTimestamp,
				replyTimestamp: raw.replyTimestamp,
				requesterId: raw.requesterId,
				replyMessageText: raw.replyMessageText,
			},
			backupRequestId
		);
		return backupRequestResult;
	}

	private mapToDb(backupRequest: BackupRequest): any {
		return {
			backupRequestId: backupRequest.idValue,
			...backupRequest.props,
			backupJobId: backupRequest.backupJobId.value,
		};
	}
}
