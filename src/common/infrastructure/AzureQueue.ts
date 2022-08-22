import { DefaultAzureCredential } from '@azure/identity';
import {
	QueueClient,
	QueueReceiveMessageResponse,
	QueueSendMessageResponse,
	RestError,
	StorageSharedKeyCredential,
} from '@azure/storage-queue';
import { fromBase64, toBase64 } from '../../utils/utils';
import { err, ok, Result } from '../core/Result';
import * as InfrastructureErrors from './InfrastructureErrors';

export type CredentialType = 'ADCC' | 'SASK';
// ADCC -> AD Client Credentials
// SASK -> Storage Account Shared Key

export interface AqSendMessageResponse extends QueueSendMessageResponse {
	isSent: boolean;
	responseStatus: number;
	sendRequestId: string;
}

export interface AqReceiveResponse extends QueueReceiveMessageResponse {
	responseStatus: number;
	receiveRequestId: string;
}

export interface AqMethodParams {
	queueName: string;
	messageText?: string;
	useBase64?: boolean;
	messageCount?: number;
}

interface AqInit {
	queueClient: QueueClient;
	messageText: string;
	messageCount: number;
	useBase64: boolean;
}

export class AzureQueue {
	// do not use 'gi' -- global flag makes it start where it left off (end of the RegExp) so next test will fail
	private static accountUriRegExp = new RegExp(`^https://[a-z0-9]{3,24}.queue.core.windows.net/$`, 'i');

	private static isValidString(s: unknown): boolean {
		return !!s && typeof s === 'string' && s.length > 0;
	}

	private static getCredential(): Result<
		DefaultAzureCredential | StorageSharedKeyCredential,
		InfrastructureErrors.EnvironmentError | Error
	> {
		const adccEnv = ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET_ID'];
		const saskEnv = ['SASK_ACCOUNT_NAME', 'SASK_ACCOUNT_KEY'];

		const credentialType = process.env.AUTH_METHOD as CredentialType;
		if (credentialType !== 'ADCC' && credentialType !== 'SASK')
			return err(
				new InfrastructureErrors.EnvironmentError(
					`{message: 'Invalid environment value', env: 'AUTH_METHOD', value: '${credentialType}'}`
				)
			);

		if (credentialType.toUpperCase() === 'ADCC') {
			for (const envName of adccEnv) {
				if (!this.isValidString(process.env[envName]))
					return err(
						new InfrastructureErrors.EnvironmentError(
							`{message: 'Invalid environment value', env: '${envName}', credentialType: 'ADCC'}`
						)
					);
			}
			return ok(new DefaultAzureCredential());
		}
		// else (because returns above)

		for (const envName of saskEnv) {
			if (!this.isValidString(process.env[envName]))
				return err(
					new InfrastructureErrors.EnvironmentError(
						`{message: 'Invalid environment value', env: '${envName}', credentialType: 'SASK'}`
					)
				);
		}
		try {
			return ok(
				new StorageSharedKeyCredential(<string>process.env.SASK_ACCOUNT_NAME, <string>process.env.SASK_ACCOUNT_KEY)
			);
		} catch (e) {
			console.log('SASK err', JSON.stringify(e, null, 3));
			return err(new Error('SASK'));
		}
	}

	private static getQueueClient(queueName: string): Result<QueueClient, InfrastructureErrors.EnvironmentError> {
		const envUri = <string>process.env.AZURE_QUEUE_ACCOUNT_URI;
		// 8 because it must begin with at least http:// (7 char) and have something after it
		const accountUri = envUri.length < 8 || envUri.slice(-1) === '/' ? envUri : envUri + '/';
		if (
			!this.isValidString(accountUri) ||
			(process.env.AUTH_METHOD === 'ADCC' && !this.accountUriRegExp.test(accountUri))
		) {
			return err(
				new InfrastructureErrors.EnvironmentError(
					`{message: 'Invalid environment value', env: 'AZURE_QUEUE_ACCOUNT_URI'}`
				)
			);
		}

		const credentialResult = this.getCredential();
		if (credentialResult.isErr()) return err(credentialResult.error as InfrastructureErrors.EnvironmentError);

		const queueUri = `${accountUri}${queueName}`;

		const queueClientOptions = {
			retryOptions: {
				maxTries: 1,
				tryTimeoutInMs: 15 * 1000,
			},
		};

		try {
			const queueClient = new QueueClient(queueUri, credentialResult.value, queueClientOptions);
			return ok(queueClient);
		} catch (e) {
			return err(new InfrastructureErrors.SDKError(`{message: 'could not create QueueClient'}`));
		}
	}

	private static initMethod(
		params: AqMethodParams
	): Result<AqInit, InfrastructureErrors.InputError | InfrastructureErrors.EnvironmentError> {
		const queueName = params.queueName;
		const useBase64 = typeof params.useBase64 === 'boolean' ? params.useBase64 : false;
		const messageText = !useBase64 ? params.messageText || '' : toBase64(params.messageText || '');
		const messageCount = typeof params.messageCount === 'number' ? Math.min(params.messageCount, 1) : 1;

		if (!this.isValidString(queueName))
			return err(
				new InfrastructureErrors.InputError(
					`{message: 'Invalid input value', name: 'queueName', value: '${queueName}'}`
				)
			);

		const queueClientResult = this.getQueueClient(queueName);
		if (queueClientResult.isErr()) {
			return err(queueClientResult.error);
		}
		return ok({ queueClient: queueClientResult.value, messageText, messageCount, useBase64 });
	}

	public static async sendMessage(
		params: AqMethodParams
	): Promise<
		Result<
			AqSendMessageResponse,
			InfrastructureErrors.InputError | InfrastructureErrors.EnvironmentError | InfrastructureErrors.SDKError
		>
	> {
		const initResult = this.initMethod(params);
		if (initResult.isErr()) {
			return err(initResult.error);
		}
		const { queueClient, messageText } = initResult.value;

		if (!this.isValidString(messageText))
			return err(
				new InfrastructureErrors.InputError(
					`{message: 'Invalid input value', name: 'messageText', value: '${messageText}'}`
				)
			);

		try {
			const sendRes = await queueClient.sendMessage(messageText);
			return ok({
				...sendRes,
				responseStatus: sendRes._response.status,
				isSent: sendRes._response.status < 300,
				sendRequestId: sendRes._response.request.requestId,
			});
		} catch (er) {
			const error = er as RestError;
			return err(
				new InfrastructureErrors.SDKError(
					`{ message: '${error.message}', name: '${error.name}', code: '${error.code}, statusCode: ${error.statusCode}, httpRequestId: ${error.request?.requestId}'}`
				)
			);
		}
	}

	public static async receiveMessages(
		params: AqMethodParams
	): Promise<
		Result<
			AqReceiveResponse,
			InfrastructureErrors.InputError | InfrastructureErrors.EnvironmentError | InfrastructureErrors.SDKError
		>
	> {
		const initResult = this.initMethod(params);
		if (initResult.isErr()) {
			return err(initResult.error);
		}
		const { queueClient, messageCount, useBase64 } = initResult.value;

		try {
			const receiveRes = await queueClient.receiveMessages({
				numberOfMessages: messageCount,
				timeout: 15 * 1000,
				visibilityTimeout: 60,
			});
			const messageItems = receiveRes.receivedMessageItems.map((item) => {
				return { ...item, messageText: useBase64 ? fromBase64(item.messageText) : item.messageText };
			});
			return ok({
				...receiveRes,
				receivedMessageItems: messageItems,
				responseStatus: receiveRes._response.status,
				receiveRequestId: receiveRes.requestId || '',
			});
		} catch (er) {
			const error = er as RestError;
			return err(
				new InfrastructureErrors.SDKError(
					`{ message: '${error.message}', name: '${error.name}', code: '${error.code}, statusCode: ${error.statusCode}, httpRequestId: ${error.request?.requestId}'}`
				)
			);
		}
	}
}
