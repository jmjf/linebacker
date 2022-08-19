import { DefaultAzureCredential } from '@azure/identity';
import { QueueClient, StorageSharedKeyCredential } from '@azure/storage-queue';
import { err, ok, Result } from '../core/Result';
import * as InfrastructureErrors from './InfrastructureErrors';

export type CredentialType = 'ADCC' | 'SASK';
// ADCC -> AD Client Credentials
// SASK -> Storage Account Shared Key

const accountUriRegExp = new RegExp(`^https://[a-z0-9]{3,24}.queue.core.windows.net`);

export class AzureQueue {
	private static isValidString(s: unknown): boolean {
		return !!s && typeof s === 'string' && s.length > 0;
	}

	private static getCredential(): Result<
		DefaultAzureCredential | StorageSharedKeyCredential,
		InfrastructureErrors.EnvironmentError
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

		switch (credentialType.toUpperCase()) {
			case 'ADCC':
				for (const envName of adccEnv) {
					if (!this.isValidString(process.env[envName]))
						return err(
							new InfrastructureErrors.EnvironmentError(
								`{msg: 'Invalid environment value', env: '${envName}', credentialType: 'ADCC'}`
							)
						);
				}
				break;

			case 'SASK':
				for (const envName of saskEnv) {
					if (!this.isValidString(process.env[envName]))
						return err(
							new InfrastructureErrors.EnvironmentError(
								`{msg: 'Invalid environment value', env: '${envName}', credentialType: 'SASK'}`
							)
						);
				}
				break;

			default:
				break;
		}
		return ok({} as StorageSharedKeyCredential);
	}

	private static getQueueClient(queueName: string): Result<QueueClient, InfrastructureErrors.EnvironmentError> {
		const accountUri = <string>process.env.AZURE_QUEUE_ACCOUNT_URI;
		if (!this.isValidString(accountUri) || (process.env.AUTH_METHOD === 'ADCC' && !accountUriRegExp.test(accountUri)))
			return err(
				new InfrastructureErrors.EnvironmentError(
					`{msg: 'Invalid environment value', env: 'AZURE_QUEUE_ACCOUNT_URI'}`
				)
			);

		const credentialResult = this.getCredential();
		if (credentialResult.isErr()) return err(credentialResult.error);

		// construct queue URI
		// create queueClient and return it

		!queueName && !accountUri;
		const queueClient = {} as QueueClient;
		return ok(queueClient);
	}

	public static async sendMessage(queueName: string, messageText: string): Promise<Result<boolean, Error>> {
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
		if (queueClientResult.isErr()) return err(queueClientResult.error);

		// call send on client
		// handle result

		!messageText;
		return ok(false);
	}
}
