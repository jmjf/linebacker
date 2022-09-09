import { PrismaContext } from '../../../infrastructure/prisma/prismaContext';
import { CircuitBreakerWithRetry, ConnectFailureErrorData } from '../../../infrastructure/CircuitBreakerWithRetry';

import { DomainEventBus } from '../../../common/domain/DomainEventBus';

import * as AdapterErrors from '../../../common/adapter/AdapterErrors';
import { err, ok, Result } from '../../../common/core/Result';
import * as DomainErrors from '../../../common/domain/DomainErrors';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';

import { BackupProviderType } from '../../../backup-job/domain/BackupProviderType';

import { BackupRequest } from '../../domain/BackupRequest';
import { RequestTransportType } from '../../domain/RequestTransportType';
import { IBackupRequestRepo } from '../IBackupRequestRepo';
import { PrismaBackupRequest } from '@prisma/client';
import { RequestStatusType } from '../../domain/RequestStatusType';
import { isPrismaConnectError } from '../../../infrastructure/prisma/isPrismaConnectError';

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);
export class PrismaBackupRequestRepo implements IBackupRequestRepo {
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

	public async exists(backupRequestId: string): Promise<Result<boolean, AdapterErrors.DatabaseError>> {
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
			const count = await this.prisma.prismaBackupRequest.count({
				where: {
					backupRequestId: backupRequestId,
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
		backupRequestId: string
	): Promise<
		Result<BackupRequest, AdapterErrors.DatabaseError | AdapterErrors.NotFoundError | DomainErrors.PropsError>
	> {
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
			const data = await this.prisma.prismaBackupRequest.findUnique({
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

	public async save(backupRequest: BackupRequest): Promise<Result<BackupRequest, AdapterErrors.DatabaseError>> {
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

		const raw = this.mapToDb(backupRequest);
		try {
			await this.prisma.prismaBackupRequest.upsert({
				where: {
					backupRequestId: raw.backupRequestId,
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
		DomainEventBus.publishEventsForAggregate(backupRequest.id);

		// The application enforces the business rules, not the database.
		// Under no circumstances should the database change the data it gets.
		// Returning the backup request allows use cases to return the result of save() if they can't do anything about a DatabaseError.
		return ok(backupRequest);
	}

	// this may belong in a mapper
	private mapToDomain(raw: PrismaBackupRequest): Result<BackupRequest, DomainErrors.PropsError> {
		const backupRequestId = new UniqueIdentifier(raw.backupRequestId);
		const backupRequestResult = BackupRequest.create(
			{
				backupJobId: raw.backupJobId,
				dataDate: raw.dataDate,
				preparedDataPathName: raw.preparedDataPathName,
				getOnStartFlag: raw.getOnStartFlag,
				transportTypeCode: raw.transportTypeCode as RequestTransportType,
				backupProviderCode: raw.backupProviderCode as BackupProviderType,
				storagePathName: raw.storagePathName === null ? undefined : raw.storagePathName,
				statusTypeCode: raw.statusTypeCode as RequestStatusType,
				receivedTimestamp: raw.receivedTimestamp,
				checkedTimestamp: raw.checkedTimestamp === null ? undefined : raw.checkedTimestamp,
				sentToInterfaceTimestamp: raw.sentToInterfaceTimestamp === null ? undefined : raw.sentToInterfaceTimestamp,
				replyTimestamp: raw.replyTimestamp === null ? undefined : raw.replyTimestamp,
				requesterId: raw.requesterId === null ? undefined : raw.requesterId,
				replyMessageText: raw.replyMessageText === null ? undefined : raw.replyMessageText,
			},
			backupRequestId
		);
		return backupRequestResult;
	}

	private mapToDb(backupRequest: BackupRequest): PrismaBackupRequest {
		return {
			backupRequestId: backupRequest.idValue,
			...backupRequest.props,

			dataDate: backupRequest.dataDate,
			preparedDataPathName: backupRequest.preparedDataPathName,
			getOnStartFlag: backupRequest.getOnStartFlag,
			transportTypeCode: backupRequest.transportTypeCode,
			backupProviderCode: backupRequest.backupProviderCode,
			storagePathName: backupRequest.storagePathName,
			statusTypeCode: backupRequest.statusTypeCode,
			receivedTimestamp: backupRequest.receivedTimestamp,
			checkedTimestamp: backupRequest.checkedTimestamp,
			sentToInterfaceTimestamp: backupRequest.sentToInterfaceTimestamp,
			replyTimestamp: backupRequest.replyTimestamp,
			requesterId: backupRequest.requesterId,
			replyMessageText: backupRequest.replyMessageText,
			backupJobId: backupRequest.backupJobId.value,
		};
	}
}
