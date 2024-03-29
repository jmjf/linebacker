import { ClientSecretCredential } from '@azure/identity';
import {
	QueueClient,
	QueueDeleteMessageResponse,
	QueueReceiveMessageResponse,
	QueueSendMessageResponse,
	RestError,
	StorageSharedKeyCredential,
} from '@azure/storage-queue';

import { fromBase64, toBase64 } from '../../common/utils/utils';
import { err, ok, Result } from '../../common/core/Result';
import * as InfrastructureErrors from '../../common/infrastructure/InfrastructureErrors';

import { appState, getMissingAppStateMembers, isAppStateUsable } from '../app-state/appState';

export interface AQSendResponse extends QueueSendMessageResponse {
	isSent: boolean;
	responseStatus: number;
}

export interface AQReceiveResponse extends QueueReceiveMessageResponse {
	responseStatus: number;
}

export interface AQDeleteResponse extends QueueDeleteMessageResponse {
	responseStatus: number;
}

export interface AQMethodParams {
	queueName: string;
	messageText?: string;
	useBase64?: boolean;
	messageCount?: number;
	messageId?: string;
	popReceipt?: string;
}

interface AqInit extends AQMethodParams {
	queueClient: QueueClient;
}

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);

export class AzureQueue {
	// do not use 'gi' -- global flag makes it start where it left off (end of the RegExp) so next test will fail
	private static accountUriRegExp = new RegExp(`^https://[a-z0-9]{3,24}.queue.core.windows.net/$`, 'i');

	private static isValidString(s: unknown): boolean {
		return !!s && typeof s === 'string' && s.length > 0;
	}

	private static getCredential(): Result<
		ClientSecretCredential | StorageSharedKeyCredential,
		InfrastructureErrors.EnvironmentError | Error
	> {
		const functionName = 'getCredential';

		if (!isAppStateUsable(['azureQueue_authMethod']))
			return err(
				new InfrastructureErrors.EnvironmentError('Unusable auth method', {
					authMethod: appState.azureQueue_authMethod,
					moduleName,
					functionName,
				})
			);

		const credentialType = appState.azureQueue_authMethod.toLowerCase();
		if (credentialType !== 'arcs' && credentialType !== 'sask')
			return err(
				new InfrastructureErrors.EnvironmentError('Invalid auth method', {
					authMethod: appState.azureQueue_authMethod,
					moduleName,
					functionName,
				})
			);

		// application startup should check if appState is usable, so no checks here
		if (credentialType === 'arcs') {
			const missingMembers = getMissingAppStateMembers([
				'azureQueue_arcsTenantId',
				'azureQueue_arcsClientId',
				'azureQueue_arcsClientSecret',
			]);
			if (missingMembers.length > 0)
				return err(
					new InfrastructureErrors.EnvironmentError('Invalid appState (ARCS)', {
						missingMembers,
						moduleName,
						functionName,
					})
				);
			// application should check if appState is set up correctly
			return ok(
				new ClientSecretCredential(
					appState.azureQueue_arcsTenantId,
					appState.azureQueue_arcsClientId,
					appState.azureQueue_arcsClientSecret
				)
			);
		}
		// else SASK (because returns above ensure it isn't ARCS)

		try {
			const missingMembers = getMissingAppStateMembers(['azureQueue_saskAccountName', 'azureQueue_saskAccountKey']);
			if (missingMembers.length > 0)
				return err(
					new InfrastructureErrors.EnvironmentError('Invalid appState (SASK)', {
						missingMembers,
						moduleName,
						functionName,
					})
				);

			// else
			return ok(
				new StorageSharedKeyCredential(appState.azureQueue_saskAccountName, appState.azureQueue_saskAccountKey)
			);
		} catch (e) {
			const { message, ...error } = e as RestError;
			if (error.request) error.request.operationSpec = undefined;
			return err(new InfrastructureErrors.SDKError(message, { error, moduleName, functionName }));
		}
	}

	private static getQueueClient(queueName: string): Result<QueueClient, InfrastructureErrors.EnvironmentError> {
		const functionName = 'getQueueClient';

		const envUri = appState.azureQueue_queueAccountUri;
		// 8 because it must begin with at least http:// (7 char) and have something after it
		const accountUri = envUri.length < 8 || envUri.slice(-1) === '/' ? envUri : envUri + '/';
		if (
			!this.isValidString(accountUri) ||
			(appState.azureQueue_authMethod.toLowerCase() === 'arcs' && !this.accountUriRegExp.test(accountUri))
		) {
			return err(
				new InfrastructureErrors.EnvironmentError('Invalid queue account uri', {
					queueAccountUri: appState.azureQueue_queueAccountUri,
					moduleName,
					functionName,
				})
			);
		}

		const credentialResult = this.getCredential();
		if (credentialResult.isErr()) return err(credentialResult.error as InfrastructureErrors.EnvironmentError);

		const queueUri = `${accountUri}${queueName}`;

		const queueClientOptions = {
			retryOptions: {
				maxTries: 1,
				tryTimeoutInMs: appState.azureQueue_connectTimeoutMs,
			},
		};

		try {
			const queueClient = new QueueClient(queueUri, credentialResult.value, queueClientOptions);
			return ok(queueClient);
		} catch (e) {
			const { message, ...error } = e as RestError;
			if (error.request) error.request.operationSpec = undefined;
			return err(new InfrastructureErrors.SDKError(message, { error, moduleName, functionName }));
		}
	}

	private static initMethod(
		params: AQMethodParams
	): Result<AqInit, InfrastructureErrors.InputError | InfrastructureErrors.EnvironmentError> {
		const functionName = 'initMethod';
		const queueName = params.queueName;
		if (!this.isValidString(queueName))
			return err(
				new InfrastructureErrors.InputError('Invalid queueName input', {
					value: queueName,
					moduleName,
					functionName,
				})
			);
		const useBase64 = typeof params.useBase64 === 'boolean' ? params.useBase64 : false;
		const messageText = !useBase64 ? params.messageText || '' : toBase64(params.messageText || '');
		const messageCount = typeof params.messageCount === 'number' ? Math.min(params.messageCount, 1) : 1;
		const messageId = params.messageId || '';
		const popReceipt = params.popReceipt || '';

		const queueClientResult = this.getQueueClient(queueName);
		if (queueClientResult.isErr()) {
			return err(queueClientResult.error);
		}
		return ok({
			queueClient: queueClientResult.value,
			queueName,
			messageText,
			messageCount,
			useBase64,
			messageId,
			popReceipt,
		});
	}

	public static async sendMessage(
		params: AQMethodParams
	): Promise<
		Result<
			AQSendResponse,
			InfrastructureErrors.InputError | InfrastructureErrors.EnvironmentError | InfrastructureErrors.SDKError
		>
	> {
		const functionName = 'sendMessage';
		const initResult = this.initMethod(params);
		if (initResult.isErr()) {
			return err(initResult.error);
		}
		const { queueClient, messageText } = initResult.value;

		if (!this.isValidString(messageText))
			return err(
				new InfrastructureErrors.InputError('Invalid messageText input', {
					value: messageText,
					moduleName,
					functionName,
				})
			);

		try {
			const sendRes = await queueClient.sendMessage(<string>messageText);
			return ok({
				...sendRes,
				responseStatus: sendRes._response.status,
				isSent: sendRes._response.status < 300,
			});
		} catch (e) {
			const { message, ...error } = e as RestError;
			// operationSpec is massive and useless, so get rid of it
			if (error.request) error.request.operationSpec = undefined;
			return err(new InfrastructureErrors.SDKError(message, { error, moduleName, functionName }));
		}
	}

	public static async receiveMessages(
		params: AQMethodParams
	): Promise<
		Result<
			AQReceiveResponse,
			InfrastructureErrors.InputError | InfrastructureErrors.EnvironmentError | InfrastructureErrors.SDKError
		>
	> {
		const functionName = 'receiveMessages';
		const initResult = this.initMethod(params);
		if (initResult.isErr()) {
			return err(initResult.error);
		}
		const { queueClient, messageCount, useBase64 } = initResult.value;

		try {
			const receiveRes = await queueClient.receiveMessages({
				numberOfMessages: messageCount,
				timeout: appState.azureQueue_connectTimeoutMs,
				visibilityTimeout: appState.azureQueue_visibilityTimeoutSec,
			});
			const messageItems = receiveRes.receivedMessageItems.map((item) => {
				return { ...item, messageText: useBase64 ? fromBase64(item.messageText) : item.messageText };
			});
			return ok({
				...receiveRes,
				receivedMessageItems: messageItems,
				responseStatus: receiveRes._response.status,
			});
		} catch (e) {
			const { message, ...error } = e as RestError;
			if (error.request) error.request.operationSpec = undefined;
			return err(new InfrastructureErrors.SDKError(message, { error, moduleName, functionName }));
		}
	}

	public static async deleteMessage(
		params: AQMethodParams
	): Promise<
		Result<
			AQDeleteResponse,
			InfrastructureErrors.InputError | InfrastructureErrors.EnvironmentError | InfrastructureErrors.SDKError
		>
	> {
		const functionName = 'deleteMessage';
		const initResult = this.initMethod(params);
		if (initResult.isErr()) {
			return err(initResult.error);
		}
		const { queueClient, messageId, popReceipt } = initResult.value;

		try {
			const deleteRes = await queueClient.deleteMessage(<string>messageId, <string>popReceipt);
			return ok({
				...deleteRes,
				responseStatus: deleteRes._response.status,
			});
		} catch (e) {
			const { message, ...error } = e as RestError;
			if (error.request) error.request.operationSpec = undefined;
			return err(new InfrastructureErrors.SDKError(message, { error, moduleName, functionName }));
		}
	}

	public static isConnectError(error: any): boolean {
		let errorCode: string | undefined = undefined;
		if (error && error.errorData && error.errorData.error && error.errorData.error.code) {
			errorCode = error.errorData.error.code;
		} else if (error && error.code) {
			errorCode = error.code;
		}
		return (
			// list of retriable errors from the Azure Queue SDK
			// azure-sdk-for-js/sdk/storage/storage-queue/src/policies/StorageRetryPolicy.ts
			errorCode !== undefined &&
			[
				'ETIMEDOUT',
				'ESOCKETTIMEDOUT',
				'ECONNREFUSED',
				'ECONNRESET',
				'ENOENT',
				'ENOTFOUND',
				'TIMEOUT',
				'EPIPE',
			].includes(errorCode)
		);
	}

	public static async isConnected(): Promise<Result<boolean, InfrastructureErrors.SDKError>> {
		const functionName = 'isConnected';
		// queue name doesn't matter; connection is what matters
		const initResult = this.initMethod({ queueName: 'test-connection' });
		if (initResult.isErr()) {
			return err(initResult.error);
		}
		const { queueClient } = initResult.value;

		try {
			const res = await queueClient.exists();
			// console.log('AQ.isConnected', res);
			return ok(true);
		} catch (e) {
			const { message, ...error } = e as RestError;
			if (error.request) error.request.operationSpec = undefined;
			// console.log('AQ.isConnected', e);
			return err(new InfrastructureErrors.SDKError(message, { error, moduleName, functionName }));
		}
	}
}
