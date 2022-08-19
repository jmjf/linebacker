import { AzureQueue, CredentialType } from './AzureQueue';

describe('AzureQueue', () => {
	test.each([
		{ envName: 'AZURE_TENANT_ID', credType: 'ADCC' },
		{ envName: 'AZURE_CLIENT_ID', credType: 'ADCC' },
		{ envName: 'AZURE_CLIENT_SECRET_ID', credType: 'ADCC' },
		{ envName: 'SASK_ACCOUNT_NAME', credType: 'SASK' },
		{ envName: 'SASK_ACCOUNT_KEY', credType: 'SASK' },
		{ envName: 'AUTH_METHOD', credType: 'invalid' },
	])(
		'when $credType credential type and $envName is invalid, it returns an err (EnvironmentError)',
		async ({ envName, credType }) => {
			// Arrange
			process.env.AZURE_TENANT_ID = credType === 'ADCC' && envName === 'AZURE_TENANT_ID' ? '' : 'tenant';
			process.env.AZURE_CLIENT_ID = credType === 'ADCC' && envName === 'AZURE_CLIENT_ID' ? '' : 'client';
			process.env.AZURE_CLIENT_SECRET = credType === 'ADCC' && envName === 'AZURE_CLIENT_SECRET_ID' ? '' : 'secret';
			process.env.SASK_ACCOUNT_NAME = credType === 'SASK' && envName === 'SASK_ACCOUNT_NAME' ? '' : 'accountName';
			process.env.SASK_ACCOUNT_KEY = credType === 'SASK' && envName === 'SASK_ACCOUNT_KEY' ? '' : 'accountKey';
			process.env.AUTH_METHOD = credType;
			process.env.AZURE_QUEUE_ACCOUNT_URI = 'https://testing.queue.core.windows.net';

			const messageText = `${envName} test`;
			const queueName = 'queueName';

			// Act
			const result = await AzureQueue.sendMessage(queueName, messageText);

			// Assert
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.name).toBe('EnvironmentError');
				expect(result.error.message).toContain(envName);
			}
		}
	);

	test.each([
		{ credType: 'ADCC', uri: '' },
		{ credType: 'ADCC', uri: 'http://nope.nowhere.com' },
		{ credType: 'ADCC', uri: 'https://12.queue.core.windows.net' },
		{ credType: 'SASK', uri: '' },
	])(
		'when AZURE_QUEUE_ACCOUNT_URI is invalid ($credType, $uri), it returns an err (EnvironmentError)',
		async ({ credType, uri }) => {
			// Arrange
			process.env.AUTH_METHOD = credType;
			process.env.SASK_ACCOUNT_NAME = 'accountName';
			process.env.SASK_ACCOUNT_KEY = 'accountKey';
			process.env.AZURE_QUEUE_ACCOUNT_URI = uri;

			const messageText = `AZURE_QUEUE_ACCOUNT_URI test`;
			const queueName = 'queueName';

			// Act
			const result = await AzureQueue.sendMessage(queueName, messageText);

			// Assert
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.name).toBe('EnvironmentError');
				expect(result.error.message).toContain('AZURE_QUEUE_ACCOUNT_URI');
			}
		}
	);

	test('when queueName is invalid, it returns an err (InputError)', async () => {
		// Arrange
		process.env.AUTH_METHOD = 'SASK';
		process.env.SASK_ACCOUNT_NAME = 'accountName';
		process.env.SASK_ACCOUNT_KEY = 'accountKey';
		process.env.AZURE_QUEUE_ACCOUNT_URI = 'uri'; // not checked for SASK because SASK it local only

		const messageText = `queueName test`;
		const queueName = '';

		// Act
		const result = await AzureQueue.sendMessage(queueName, messageText);

		// Assert
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.name).toBe('InputError');
			expect(result.error.message).toContain('queueName');
		}
	});

	test('when messageText is invalid, it returns an err (InputError)', async () => {
		// Arrange
		process.env.AUTH_METHOD = 'SASK';
		process.env.SASK_ACCOUNT_NAME = 'accountName';
		process.env.SASK_ACCOUNT_KEY = 'accountKey';
		process.env.AZURE_QUEUE_ACCOUNT_URI = 'uri'; // not checked for SASK because SASK it local only

		const messageText = ``;
		const queueName = 'queueName';

		// Act
		const result = await AzureQueue.sendMessage(queueName, messageText);

		// Assert
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.name).toBe('InputError');
			expect(result.error.message).toContain('messageText');
		}
	});
});
