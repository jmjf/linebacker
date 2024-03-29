import { TypeormBackupRequest } from '../../../infrastructure/typeorm/entity/TypeormBackupRequest.entity';
import { isTypeormConnectError } from '../../../infrastructure/typeorm/isTypeormConnectError';
import { TypeormContext } from '../../../infrastructure/typeorm/typeormContext';
import {
	CircuitBreakerWithRetry,
	ConnectFailureErrorData,
} from '../../../infrastructure/resilience/CircuitBreakerWithRetry';

import { err, ok, Result } from '../../../common/core/Result';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';
import { eventBus } from '../../../common/infrastructure/event-bus/eventBus';
import * as DomainErrors from '../../../common/domain/DomainErrors';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';
import * as InfrastructureErrors from '../../../common/infrastructure/InfrastructureErrors';

import { BackupProviderType } from '../../../backup-job/domain/BackupProviderType';

import { BackupRequest } from '../../domain/BackupRequest';
import { RequestTransportType } from '../../domain/RequestTransportType';
import { IBackupRequestRepo } from '../IBackupRequestRepo';

import { BackupRequestStatusType, BackupRequestStatusTypeValues } from '../../domain/BackupRequestStatusType';
import { LessThan } from 'typeorm';

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);
export class TypeormBackupRequestRepo implements IBackupRequestRepo {
	private typeormCtx: TypeormContext;
	private circuitBreaker: CircuitBreakerWithRetry;
	private connectFailureErrorData: ConnectFailureErrorData;

	constructor(typeormCtx: TypeormContext, circuitBreaker: CircuitBreakerWithRetry) {
		// Use TypeORM's EntityManager because I don't want to put my repo intelligence in
		// a TypeORM construct because doing so creates tight coupling to TypeORM.
		this.typeormCtx = typeormCtx;
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
			const count = await this.typeormCtx.manager.count(TypeormBackupRequest, {
				where: {
					backupRequestId: backupRequestId,
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
			const data = await this.typeormCtx.manager.findOne(TypeormBackupRequest, {
				where: {
					backupRequestId: backupRequestId,
				},
			});

			this.circuitBreaker.onSuccess();

			if (data === null) {
				return err(
					new AdapterErrors.NotFoundError('BackupRequest not found for backupRequestId', { backupRequestId })
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

			return err(new AdapterErrors.DatabaseError(message, { ...error, ...errorData, moduleName, functionName }));
		}
	}

	public async getByStatusBeforeTimestamp(
		status: BackupRequestStatusType,
		beforeTimestamp: Date
	): Promise<
		Result<
			Result<BackupRequest, DomainErrors.PropsError>[],
			AdapterErrors.DatabaseError | AdapterErrors.NotFoundError
		>
	> {
		const functionName = 'getRequestIdsByStatus';

		if (!this.circuitBreaker.isConnected()) {
			return err(
				new AdapterErrors.DatabaseError('Fast fail', {
					...this.connectFailureErrorData,
					moduleName,
					functionName,
				})
			);
		}

		let whereDateTerm = {};
		switch (status) {
			case BackupRequestStatusTypeValues.Received:
				whereDateTerm = {
					receivedTimestamp: LessThan(beforeTimestamp),
				};
				break;
			case BackupRequestStatusTypeValues.Allowed:
			case BackupRequestStatusTypeValues.NotAllowed:
				whereDateTerm = {
					checkedTimestamp: LessThan(beforeTimestamp),
				};
				break;
			case BackupRequestStatusTypeValues.Sent:
				whereDateTerm = {
					sentToInterfaceTimestamp: LessThan(beforeTimestamp),
				};
				break;
			case BackupRequestStatusTypeValues.Succeeded:
			case BackupRequestStatusTypeValues.Failed:
				whereDateTerm = {
					replyTimestamp: LessThan(beforeTimestamp),
				};
				break;
		}

		try {
			const data = await this.typeormCtx.manager.find(TypeormBackupRequest, {
				where: {
					...whereDateTerm,
					statusTypeCode: status,
				},
			});

			this.circuitBreaker.onSuccess();

			if (data.length === 0) {
				return err(
					new AdapterErrors.NotFoundError('BackupRequests not found for status and timestamp', {
						status,
						beforeTimestamp,
					})
				);
			}

			return ok(data.map((br) => this.mapToDomain(br)));
		} catch (e) {
			const { message, ...error } = e as Error;
			let errorData = { isConnectFailure: false };

			if (isTypeormConnectError(error)) {
				this.circuitBreaker.onFailure();
				errorData = this.connectFailureErrorData;
			}

			return err(new AdapterErrors.DatabaseError(message, { ...error, ...errorData, moduleName, functionName }));
		}
	}

	public async save(
		backupRequest: BackupRequest
	): Promise<Result<BackupRequest, AdapterErrors.DatabaseError | InfrastructureErrors.EventBusError>> {
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
			await this.typeormCtx.manager.save(TypeormBackupRequest, { ...raw });
			this.circuitBreaker.onSuccess();

			// trigger domain events
			const publishResult = await eventBus.publishEventsBulk(backupRequest.events);
			if (publishResult.isErr()) {
				return err(publishResult.error);
			}

			// The application enforces the business rules, not the database.
			// Under no circumstances should the database change the data it gets.
			// Returning the backup request allows use cases to return the result of save() if they can't do anything about a DatabaseError.
			return ok(backupRequest);
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

	// this may belong in a mapper
	private mapToDomain(raw: TypeormBackupRequest): Result<BackupRequest, DomainErrors.PropsError> {
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
				statusTypeCode: raw.statusTypeCode as BackupRequestStatusType,
				acceptedTimestamp: raw.acceptedTimestamp === null ? undefined : raw.acceptedTimestamp,
				receivedTimestamp: raw.receivedTimestamp === null ? undefined : raw.receivedTimestamp,
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

	private mapToDb(backupRequest: BackupRequest): TypeormBackupRequest {
		return {
			backupRequestId: backupRequest.idValue,
			backupJobId: backupRequest.backupJobId.value,
			dataDate: backupRequest.dataDate,
			preparedDataPathName: backupRequest.preparedDataPathName,
			getOnStartFlag: backupRequest.getOnStartFlag,
			transportTypeCode: backupRequest.transportTypeCode,
			backupProviderCode: backupRequest.backupProviderCode,
			storagePathName: backupRequest.storagePathName,
			statusTypeCode: backupRequest.statusTypeCode,
			acceptedTimestamp: backupRequest.acceptedTimestamp,
			receivedTimestamp: backupRequest.receivedTimestamp,
			checkedTimestamp: backupRequest.checkedTimestamp,
			sentToInterfaceTimestamp: backupRequest.sentToInterfaceTimestamp,
			replyTimestamp: backupRequest.replyTimestamp,
			replyMessageText: backupRequest.replyMessageText,
			requesterId: backupRequest.requesterId,
		};
	}
}
