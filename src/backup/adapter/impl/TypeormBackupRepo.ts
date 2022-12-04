import { TypeormContext } from '../../../infrastructure/typeorm/typeormContext';
import {
	CircuitBreakerWithRetry,
	ConnectFailureErrorData,
} from '../../../infrastructure/resilience/CircuitBreakerWithRetry';

import { err, ok, Result } from '../../../common/core/Result';
import { eventBus } from '../../../common/infrastructure/event-bus/eventBus';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';
import * as DomainErrors from '../../../common/domain/DomainErrors';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';

import { BackupProviderType } from '../../../backup-job/domain/BackupProviderType';

import { Backup } from '../../domain/Backup';
import { IBackupRepo } from '../IBackupRepo';
import { TypeormBackup } from '../../../infrastructure/typeorm/entity/TypeormBackup.entity';
import { isTypeormConnectError } from '../../../infrastructure/typeorm/isTypeormConnectError';

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);
export class TypeormBackupRepo implements IBackupRepo {
	private typeorm: TypeormContext;
	private circuitBreaker: CircuitBreakerWithRetry;
	private connectFailureErrorData: ConnectFailureErrorData;

	constructor(ctx: TypeormContext, circuitBreaker: CircuitBreakerWithRetry) {
		this.typeorm = ctx;
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
			const count = await this.typeorm.manager.count(TypeormBackup, {
				where: {
					backupId: backupId,
				},
			});

			this.circuitBreaker.onSuccess();

			return ok(count > 0);
		} catch (e) {
			const { message, ...error } = e as Error;
			let errorData = { isConnectFailure: false };

			if (isTypeormConnectError(error)) {
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
			const data = await this.typeorm.manager.findOne(TypeormBackup, {
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

			if (isTypeormConnectError(error)) {
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
			const data = await this.typeorm.manager.findOne(TypeormBackup, {
				where: {
					backupRequestId: backupRequestId,
				},
			});

			this.circuitBreaker.onSuccess();

			if (data === null) {
				return err(
					new AdapterErrors.NotFoundError('Backup request not found for backupRequestId', { backupRequestId })
				);
			}

			return this.mapToDomain(data);
		} catch (e) {
			const { message, ...error } = e as Error;
			let errorData = { isConnectFailure: false };

			if (isTypeormConnectError(error)) {
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
			await this.typeorm.manager.save(TypeormBackup, {
				...raw,
			});

			this.circuitBreaker.onSuccess();
		} catch (e) {
			const { message, ...error } = e as Error;
			let errorData = { isConnectFailure: false };

			if (isTypeormConnectError(error)) {
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
		eventBus.publishEventsBulk(backup.events);

		// The application enforces the business rules, not the database.
		// Under no circumstances should the database change the data it gets.
		// Returning the backup request allows use cases to return the result of save() if they can't do anything about a DatabaseError.
		return ok(backup);
	}
				
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
