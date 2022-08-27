import { TypeormContext } from '../../../common/infrastructure/database/typeormContext';

import { err, ok, Result } from '../../../common/core/Result';
import { DomainEventBus } from '../../../common/domain/DomainEventBus';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';
import * as DomainErrors from '../../../common/domain/DomainErrors';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';

import { BackupProviderType } from '../../../backup-job/domain/BackupProviderType';

import { Backup } from '../../domain/Backup';
import { IBackupRepo } from '../BackupRepo';
import { TypeormBackup } from '../../../typeorm/entity/TypeormBackup.entity';

export class TypeormBackupRepo implements IBackupRepo {
	private typeorm: TypeormContext;

	constructor(ctx: TypeormContext) {
		this.typeorm = ctx;
	}

	public async exists(backupId: string): Promise<Result<boolean, AdapterErrors.DatabaseError>> {
		// count the number of rows that meet the condition
		try {
			const count = await this.typeorm.manager.count(TypeormBackup, {
				where: {
					backupId: backupId,
				},
			});

			return ok(count > 0);
		} catch (e) {
			return err(new AdapterErrors.DatabaseError(`${JSON.stringify(e)}`));
		}
	}

	public async getById(
		backupId: string
	): Promise<Result<Backup, AdapterErrors.DatabaseError | AdapterErrors.NotFoundError | DomainErrors.PropsError>> {
		try {
			const data = await this.typeorm.manager.findOne(TypeormBackup, {
				where: {
					backupId: backupId,
				},
			});

			if (data === null) {
				return err(new AdapterErrors.NotFoundError(`Backup not found |${backupId}|`));
			}

			return this.mapToDomain(data);
		} catch (e) {
			return err(new AdapterErrors.DatabaseError(`${JSON.stringify(e)}`));
		}
	}

	public async getByBackupRequestId(
		backupRequestId: string
	): Promise<Result<Backup, AdapterErrors.DatabaseError | AdapterErrors.NotFoundError>> {
		try {
			const data = await this.typeorm.manager.findOne(TypeormBackup, {
				where: {
					backupRequestId: backupRequestId,
				},
			});

			if (data === null) {
				return err(new AdapterErrors.NotFoundError(`Backup not found for request |${backupRequestId}|`));
			}

			return this.mapToDomain(data);
		} catch (e) {
			return err(new AdapterErrors.DatabaseError(`${JSON.stringify(e)}`));
		}
	}

	public async save(backup: Backup): Promise<Result<Backup, AdapterErrors.DatabaseError>> {
		const raw = this.mapToDb(backup);

		try {
			await this.typeorm.manager.save(TypeormBackup, {
				...raw,
			});
		} catch (e) {
			return err(new AdapterErrors.DatabaseError(`${JSON.stringify(e)}`));
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
				backupByteCount: raw.backupByteCount,
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
			backupByteCount: backup.backupByteCount,
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
