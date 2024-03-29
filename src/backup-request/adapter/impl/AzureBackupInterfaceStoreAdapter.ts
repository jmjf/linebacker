import { err, ok, Result } from '../../../common/core/Result';

import * as AdapterErrors from '../../../common/adapter/AdapterErrors';

import { AzureQueue } from '../../../infrastructure/azure-queue/AzureQueue';
import {
	CircuitBreakerWithRetry,
	ConnectFailureErrorData,
} from '../../../infrastructure/resilience/CircuitBreakerWithRetry';

import { BackupRequest } from '../../domain/BackupRequest';
import {
	BackupInterfaceStoreAdapterErrors,
	IBackupInterfaceStoreAdapter,
	StoreSendResponse,
} from '../IBackupInterfaceStoreAdapter';
import {
	AzureQueueDeleteResponse,
	AzureQueueReceiveResponse,
} from '../../../infrastructure/azure-queue/IAzureQueueAdapter';
import path from 'path';
import { Backup } from '../../../backup/domain/Backup';

const moduleName = path.basename(module.filename);

// Note IBISA extends IAzureQueueAdapter and implements its methods, so can be used as an IAQA too
export class AzureBackupInterfaceStoreAdapter implements IBackupInterfaceStoreAdapter {
	private _queueName: string;
	private useBase64: boolean;
	private circuitBreaker: CircuitBreakerWithRetry;
	private connectFailureErrorData: ConnectFailureErrorData;

	constructor(queueName: string, circuitBreaker: CircuitBreakerWithRetry, useBase64 = false) {
		this._queueName = queueName;
		this.useBase64 = useBase64;
		this.circuitBreaker = circuitBreaker;
		this.connectFailureErrorData = {
			isConnectFailure: true,
			isConnected: this.circuitBreaker.isConnected.bind(this.circuitBreaker),
			addRetryEvent: this.circuitBreaker.addRetryEvent.bind(this.circuitBreaker),
			serviceName: this.circuitBreaker.serviceName,
		};
	}

	get queueName(): string {
		return this._queueName;
	}

	public async send(
		backupRequest: BackupRequest
	): Promise<Result<StoreSendResponse, BackupInterfaceStoreAdapterErrors>> {
		const functionName = 'send';

		if (!this.circuitBreaker.isConnected()) {
			return err(
				new AdapterErrors.InterfaceAdapterError('Fast fail', {
					...this.connectFailureErrorData,
					moduleName,
					functionName,
				})
			);
		}

		const messageText = JSON.stringify(this.mapToQueue(backupRequest));

		const startTime = new Date();
		const result = await AzureQueue.sendMessage({
			queueName: this._queueName,
			messageText,
			useBase64: this.useBase64,
		});
		const endTime = new Date();

		if (result.isErr()) {
			// console.log('send error', AzureQueue.isConnectError(result.error), result.error);
			if (AzureQueue.isConnectError(result.error)) {
				this.circuitBreaker.onFailure();
				result.error.errorData = { ...result.error.errorData, ...this.connectFailureErrorData };
			}
			return err(result.error);
		}

		this.circuitBreaker.onSuccess();

		const response: StoreSendResponse = {
			backupRequestId: backupRequest.backupRequestId.value,
			isSent: result.value.isSent,
			responseStatus: result.value.responseStatus,
			startTime,
			endTime,
			insertedOn: result.value.insertedOn,
			messageId: result.value.messageId,
			sendRequestId: result.value.requestId,
		};
		return ok(response);
	}

	public async receive(
		messageCount: number
	): Promise<Result<AzureQueueReceiveResponse, BackupInterfaceStoreAdapterErrors>> {
		const functionName = 'receive';

		if (!this.circuitBreaker.isConnected()) {
			return err(
				new AdapterErrors.InterfaceAdapterError('Fast fail', {
					...this.connectFailureErrorData,
					moduleName,
					functionName,
				})
			);
		}

		// ensure messageCount is usable
		if (typeof messageCount !== 'number' || messageCount < 1) messageCount = 1;

		const startTime = new Date();
		const result = await AzureQueue.receiveMessages({
			queueName: this._queueName,
			useBase64: this.useBase64,
			messageCount,
		});
		const endTime = new Date();

		if (result.isErr()) {
			if (AzureQueue.isConnectError(result.error)) {
				this.circuitBreaker.onFailure();
				result.error.errorData = { ...result.error.errorData, ...this.connectFailureErrorData };
			}
			return err(result.error);
		}

		this.circuitBreaker.onSuccess();

		return ok({ messages: result.value.receivedMessageItems, startTime, endTime } as AzureQueueReceiveResponse);
	}

	public async delete(
		messageId: string,
		popReceipt: string
	): Promise<Result<AzureQueueDeleteResponse, BackupInterfaceStoreAdapterErrors>> {
		const functionName = 'delete';

		if (!this.circuitBreaker.isConnected()) {
			return err(
				new AdapterErrors.InterfaceAdapterError('Fast fail', {
					...this.connectFailureErrorData,
					moduleName,
					functionName,
				})
			);
		}

		const startTime = new Date();
		const result = await AzureQueue.deleteMessage({ queueName: this._queueName, messageId, popReceipt });
		const endTime = new Date();

		if (result.isErr()) {
			if (AzureQueue.isConnectError(result.error)) {
				this.circuitBreaker.onFailure();
				result.error.errorData = { ...result.error.errorData, ...this.connectFailureErrorData };
			}
			return err(result.error);
		}

		this.circuitBreaker.onSuccess();

		return ok({ responseStatus: result.value.responseStatus, startTime, endTime });
	}

	private mapToQueue(backupRequest: BackupRequest) {
		return {
			backupRequestId: backupRequest.backupRequestId.value,
			backupJobId: backupRequest.backupJobId.value,
			dataDate: backupRequest.dataDate.toISOString().slice(0, 10), // date part only
			preparedDataPathName: backupRequest.preparedDataPathName,
		};
	}
}
