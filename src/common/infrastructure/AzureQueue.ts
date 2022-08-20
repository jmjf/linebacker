import { DefaultAzureCredential } from '@azure/identity';
import { QueueClient, QueueSendMessageResponse, RestError, StorageSharedKeyCredential } from '@azure/storage-queue';
import { err, ok, Result } from '../core/Result';
import * as InfrastructureErrors from './InfrastructureErrors';

export type CredentialType = 'ADCC' | 'SASK';
// ADCC -> AD Client Credentials
// SASK -> Storage Account Shared Key

export interface AqQueueSendMessageResponse extends QueueSendMessageResponse {
	isSent: boolean;
	responseStatus: number;
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
					`{msg: 'Invalid environment value', env: 'AUTH_METHOD', value: '${credentialType}'}`
				)
			);

		if (credentialType.toUpperCase() === 'ADCC') {
			for (const envName of adccEnv) {
				if (!this.isValidString(process.env[envName]))
					return err(
						new InfrastructureErrors.EnvironmentError(
							`{msg: 'Invalid environment value', env: '${envName}', credentialType: 'ADCC'}`
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
						`{msg: 'Invalid environment value', env: '${envName}', credentialType: 'SASK'}`
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
					`{msg: 'Invalid environment value', env: 'AZURE_QUEUE_ACCOUNT_URI'}`
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
			// console.log('gqc try');
			return ok(queueClient);
		} catch (e) {
			// console.log('gqc error', JSON.stringify(e, null, 3));
		}
		// console.log('gqc final return');
		return ok({} as QueueClient);
	}

	public static async sendMessage(
		queueName: string,
		messageText: string
	): Promise<
		Result<
			AqQueueSendMessageResponse,
			InfrastructureErrors.InputError | InfrastructureErrors.EnvironmentError | InfrastructureErrors.SDKError
		>
	> {
		if (!this.isValidString(queueName))
			return err(
				new InfrastructureErrors.InputError(
					`{msg: 'Invalid input value', name: 'queueName', value: '${queueName}'}`
				)
			);

		if (!this.isValidString(messageText))
			return err(
				new InfrastructureErrors.InputError(
					`{msg: 'Invalid input value', name: 'messageText', value: '${messageText}'}`
				)
			);

		const queueClientResult = this.getQueueClient(queueName);
		if (queueClientResult.isErr()) {
			return err(queueClientResult.error);
		}
		const queueClient = queueClientResult.value;

		try {
			const sendRes = await queueClient.sendMessage(messageText);
			console.log('sendMessage sendRes', JSON.stringify(sendRes, null, 3));
			return ok({ ...sendRes, responseStatus: sendRes._response.status, isSent: sendRes._response.status < 300 });
		} catch (er) {
			const error = er as RestError;
			console.log('sendmessage er', error);
			return err(
				new InfrastructureErrors.SDKError(
					`{ msg: '${error.message}', name: '${error.name}', code: '${error.code}'}`
				)
			);
		}
	}
}