import { TypeormContext } from '../../../common/infrastructure/typeormContext';

import { err, ok, Result } from '../../../common/core/Result';
import { DomainEventBus } from '../../../common/domain/DomainEventBus';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';
import * as DomainErrors from '../../../common/domain/DomainErrors';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';

import { BackupProviderType } from '../../../backup-job/domain/BackupProviderType';

import { Backup } from '../../domain/Backup';
import { IBackupRepo } from '../BackupRepo';
import { TypeormBackup } from '../../../typeorm/entity/TypeormBackup.entity';

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);
export class TypeormBackupRepo implements IBackupRepo {
	private typeorm: TypeormContext;

	constructor(ctx: TypeormContext) {
		this.typeorm = ctx;
	}

	public async exists(backupId: string): Promise<Result<boolean, AdapterErrors.DatabaseError>> {
		const functionName = 'exists';
		// count the number of rows that meet the condition
		try {
			const count = await this.typeorm.manager.count(TypeormBackup, {
				where: {
					backupId: backupId,
				},
			});

			return ok(count > 0);
		} catch (e) {
			const { message, ...error } = e as Error;
			return err(new AdapterErrors.DatabaseError(message, { ...error, moduleName, functionName }));
		}
	}

	public async getById(
		backupId: string
	): Promise<Result<Backup, AdapterErrors.DatabaseError | AdapterErrors.NotFoundError | DomainErrors.PropsError>> {
		const functionName = 'getById';
		try {
			const data = await this.typeorm.manager.findOne(TypeormBackup, {
				where: {
					backupId: backupId,
				},
			});

			if (data === null) {
				return err(new AdapterErrors.NotFoundError('Backup not found for backupId', { backupId }));
			}

			return this.mapToDomain(data);
		} catch (e) {
			const { message, ...error } = e as Error;
			return err(new AdapterErrors.DatabaseError(message, { ...error, moduleName, functionName }));
		}
	}

	public async getByBackupRequestId(
		backupRequestId: string
	): Promise<Result<Backup, AdapterErrors.DatabaseError | AdapterErrors.NotFoundError>> {
		const functionName = 'getByBackupRequestId';
		try {
			const data = await this.typeorm.manager.findOne(TypeormBackup, {
				where: {
					backupRequestId: backupRequestId,
				},
			});

			if (data === null) {
				return err(
					new AdapterErrors.NotFoundError('Backup request not found for backupRequestId', { backupRequestId })
				);
			}

			return this.mapToDomain(data);
		} catch (e) {
			const { message, ...error } = e as Error;
			return err(new AdapterErrors.DatabaseError(message, { ...error, moduleName, functionName }));
		}
	}

	public async save(backup: Backup): Promise<Result<Backup, AdapterErrors.DatabaseError>> {
		const functionName = 'save';
		const raw = this.mapToDb(backup);

		try {
			await this.typeorm.manager.save(TypeormBackup, {
				...raw,
			});
		} catch (e) {
			const { message, ...error } = e as Error;
			return err(new AdapterErrors.DatabaseError(message, { ...error, moduleName, functionName }));
		}

		// trigger domain events
		DomainEventBus.publishEventsForAggregate(backup.id);

		// The application enforces the business rules, not the database.
		// Under no circumstances should the database change the data it gets.
		// Returning the backup request allows use cases to return the result of save() if they can't do anything about a DatabaseError.
		return ok(backup);
	}

	// this may belong in a mapper
	private mapToDomain(raw: TypeormBackup): Result<Backup, DomainErrors.PropsError> {
		const backupId = new UniqueIdentifier(raw.backupId);
		const backupResult = Backup.create(
			{
				backupRequestId: new UniqueIdentifier(raw.backupRequestId),
				backupJobId: new UniqueIdentifier(raw.backupJobId),
				dataDate: raw.dataDate,
				backupProviderCode: raw.backupProviderCode as BackupProviderType,
				storagePathName: raw.storagePathName,
				daysToKeepCount: raw.daysToKeepCount,
				holdFlag: raw.holdFlag,
				// parseInt could return NaN if the string is not numeric or the value is too large
				// but this value is program driven and MAX_SAFE_INTEGER is 9-peta so very low risk
				backupByteCount: parseInt(raw.backupByteCount),
				copyStartTimestamp: raw.copyStartTimestamp,
				copyEndTimestamp: raw.copyEndTimestamp,
				verifyStartTimestamp: raw.verifyStartTimestamp === null ? undefined : raw.verifyStartTimestamp,
				verifyEndTimestamp: raw.verifyEndTimestamp === null ? undefined : raw.verifyEndTimestamp,
				verifyHashText: raw.verifyHashText === null ? undefined : raw.verifyHashText,
				dueToDeleteDate: raw.dueToDeleteDate === null ? undefined : raw.dueToDeleteDate,
				deletedTimestamp: raw.deletedTimestamp === null ? undefined : raw.deletedTimestamp,
			},
			backupId
		);
		return backupResult;
	}

	private mapToDb(backup: Backup): TypeormBackup {
		// can cast dates to Date because the domain translates strings to Date as part of create()
		// explicit mapping lets me use the getters on the Entity/AggregateRoot, which handle type translation
		return {
			backupId: backup.idValue,
			backupRequestId: backup.backupRequestId.value,
			backupJobId: backup.backupJobId.value,
			dataDate: backup.dataDate,
			storagePathName: backup.storagePathName,
			backupProviderCode: backup.backupProviderCode,
			daysToKeepCount: backup.daysToKeepCount,
			holdFlag: backup.holdFlag,
			backupByteCount: backup.backupByteCount.toString(),
			copyStartTimestamp: backup.copyStartTimestamp,
			copyEndTimestamp: backup.copyEndTimestamp,
			verifyStartTimestamp: backup.verifyStartTimestamp,
			verifyEndTimestamp: backup.verifyEndTimestamp,
			verifyHashText: backup.verifyHashText,
			dueToDeleteDate: backup.dueToDeleteDate,
			deletedTimestamp: backup.deletedTimestamp,
		};
	}
}
