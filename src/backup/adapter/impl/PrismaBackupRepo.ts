import { PrismaContext } from '../../../common/infrastructure/prismaContext';

import { DomainEventBus } from '../../../common/domain/DomainEventBus';

import * as AdapterErrors from '../../../common/adapter/AdapterErrors';
import { err, ok, Result } from '../../../common/core/Result';
import * as DomainErrors from '../../../common/domain/DomainErrors';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';

import { BackupProviderType } from '../../../backup-job/domain/BackupProviderType';

import { Backup } from '../../domain/Backup';
import { IBackupRepo } from '../BackupRepo';
import { PrismaBackup } from '@prisma/client';

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);
export class PrismaBackupRepo implements IBackupRepo {
	private prisma;

	constructor(ctx: PrismaContext) {
		this.prisma = ctx.prisma;
	}

	public async exists(backupId: string): Promise<Result<boolean, AdapterErrors.DatabaseError>> {
		const functionName = 'exists';
		// count the number of rows that meet the condition
		try {
			const count = await this.prisma.prismaBackup.count({
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
			const data = await this.prisma.prismaBackup.findUnique({
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
			const data = await this.prisma.prismaBackup.findFirst({
				where: {
					backupRequestId: backupRequestId,
				},
			});

			if (data === null) {
				return err(new AdapterErrors.NotFoundError('Backup not found for backupRequestId', { backupRequestId }));
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
			await this.prisma.prismaBackup.upsert({
				where: {
					backupId: raw.backupId,
				},
				update: {
					...raw,
				},
				create: {
					...raw,
				},
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
	private mapToDomain(raw: PrismaBackup): Result<Backup, DomainErrors.PropsError> {
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
				backupByteCount: parseInt(raw.backupByteCount.toString()),
				copyStartTimestamp: raw.copyStartTimestamp,
				copyEndTimestamp: raw.copyEndTimestamp,
				verifyStartTimestamp: raw.verifyStartTimestamp,
				verifyEndTimestamp: raw.verifyEndTimestamp,
				verifyHashText: raw.verifyHashText,
				dueToDeleteDate: raw.dueToDeleteDate,
				deletedTimestamp: raw.deletedTimestamp === null ? undefined : raw.deletedTimestamp,
			},
			backupId
		);
		return backupResult;
	}

	private mapToDb(backup: Backup): PrismaBackup {
		return {
			backupId: backup.idValue,
			backupRequestId: backup.backupRequestId.value,
			backupJobId: backup.backupJobId.value,
			dataDate: backup.dataDate,
			storagePathName: backup.storagePathName,
			backupProviderCode: backup.backupProviderCode,
			daysToKeepCount: backup.daysToKeepCount,
			holdFlag: backup.holdFlag,
			backupByteCount: BigInt(backup.backupByteCount),
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
