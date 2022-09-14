import { PrismaContext } from '../../../infrastructure/prisma/prismaContext';
import {
	CircuitBreakerWithRetry,
	ConnectFailureErrorData,
} from '../../../infrastructure/resilience/CircuitBreakerWithRetry';

import { DomainEventBus } from '../../../common/domain/DomainEventBus';

import * as AdapterErrors from '../../../common/adapter/AdapterErrors';
import { err, ok, Result } from '../../../common/core/Result';
import * as DomainErrors from '../../../common/domain/DomainErrors';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';

import { BackupProviderType } from '../../../backup-job/domain/BackupProviderType';

import { Backup } from '../../domain/Backup';
import { IBackupRepo } from '../IBackupRepo';
import { PrismaBackup } from '@prisma/client';
import { isPrismaConnectError } from '../../../infrastructure/prisma/isPrismaConnectError';

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);
export class PrismaBackupRepo implements IBackupRepo {
	private prisma;
	private circuitBreaker: CircuitBreakerWithRetry;
	private connectFailureErrorData: ConnectFailureErrorData;

	constructor(ctx: PrismaContext, circuitBreaker: CircuitBreakerWithRetry) {
		this.prisma = ctx.prisma;
		this.circuitBreaker = circuitBreaker;
		this.connectFailureErrorData = {
			isConnectFailure: true,
			isConnected: this.circuitBreaker.isConnected.bind(this.circuitBreaker),
			addRetryEvent: this.circuitBreaker.addRetryEvent.bind(this.circuitBreaker),
			serviceName: this.circuitBreaker.serviceName,
		};
	}

	public async exists(backupId: string): Promise<Result<boolean, AdapterErrors.DatabaseError>> {
		const functionName = 'exists';

		if (!this.circuitBreaker.isConnected()) {
			return err(
				new AdapterErrors.DatabaseError('Fast fail', {
					...this.connectFailureErrorData,
					moduleName,
					functionName,
				})
			);
		}
		// count the number of rows that meet the condition
		try {
			const count = await this.prisma.prismaBackup.count({
				where: {
					backupId: backupId,
				},
			});

			this.circuitBreaker.onSuccess();

			return ok(count > 0);
		} catch (e) {
			const { message, ...error } = e as Error;
			let errorData = { isConnectFailure: false };

			if (isPrismaConnectError(error)) {
				this.circuitBreaker.onFailure();
				errorData = this.connectFailureErrorData;
			}

			return err(
				new AdapterErrors.DatabaseError(message, {
					...error,
					...errorData,
					moduleName,
					functionName,
				})
			);
		}
	}

	public async getById(
		backupId: string
	): Promise<Result<Backup, AdapterErrors.DatabaseError | AdapterErrors.NotFoundError | DomainErrors.PropsError>> {
		const functionName = 'getById';

		if (!this.circuitBreaker.isConnected()) {
			return err(
				new AdapterErrors.DatabaseError('Fast fail', {
					...this.connectFailureErrorData,
					moduleName,
					functionName,
				})
			);
		}

		try {
			const data = await this.prisma.prismaBackup.findUnique({
				where: {
					backupId: backupId,
				},
			});

			this.circuitBreaker.onSuccess();

			if (data === null) {
				return err(new AdapterErrors.NotFoundError('Backup not found for backupId', { backupId }));
			}

			return this.mapToDomain(data);
		} catch (e) {
			const { message, ...error } = e as Error;
			let errorData = { isConnectFailure: false };

			if (isPrismaConnectError(error)) {
				this.circuitBreaker.onFailure();
				errorData = this.connectFailureErrorData;
			}

			return err(
				new AdapterErrors.DatabaseError(message, {
					...error,
					...errorData,
					moduleName,
					functionName,
				})
			);
		}
	}

	public async getByBackupRequestId(
		backupRequestId: string
	): Promise<Result<Backup, AdapterErrors.DatabaseError | AdapterErrors.NotFoundError>> {
		const functionName = 'getByBackupRequestId';

		if (!this.circuitBreaker.isConnected()) {
			return err(
				new AdapterErrors.DatabaseError('Fast fail', {
					...this.connectFailureErrorData,
					moduleName,
					functionName,
				})
			);
		}

		try {
			const data = await this.prisma.prismaBackup.findFirst({
				where: {
					backupRequestId: backupRequestId,
				},
			});

			this.circuitBreaker.onSuccess();

			if (data === null) {
				return err(new AdapterErrors.NotFoundError('Backup not found for backupRequestId', { backupRequestId }));
			}

			return this.mapToDomain(data);
		} catch (e) {
			const { message, ...error } = e as Error;
			let errorData = { isConnectFailure: false };

			if (isPrismaConnectError(error)) {
				this.circuitBreaker.onFailure();
				errorData = this.connectFailureErrorData;
			}

			return err(
				new AdapterErrors.DatabaseError(message, {
					...error,
					...errorData,
					moduleName,
					functionName,
				})
			);
		}
	}

	public async save(backup: Backup): Promise<Result<Backup, AdapterErrors.DatabaseError>> {
		const functionName = 'save';

		if (!this.circuitBreaker.isConnected()) {
			return err(
				new AdapterErrors.DatabaseError('Fast fail', {
					...this.connectFailureErrorData,
					moduleName,
					functionName,
				})
			);
		}

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

			this.circuitBreaker.onSuccess();
		} catch (e) {
			const { message, ...error } = e as Error;
			let errorData = { isConnectFailure: false };

			if (isPrismaConnectError(error)) {
				this.circuitBreaker.onFailure();
				errorData = this.connectFailureErrorData;
			}

			return err(
				new AdapterErrors.DatabaseError(message, {
					...error,
					...errorData,
					moduleName,
					functionName,
				})
			);
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
