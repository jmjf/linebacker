import { reproTest } from './Repro';

const queueAccountUri = `https://test123.queue.core.windows.net`;

test.each([
	{ envName: 'SASK_ACCOUNT_NAME', credType: 'SASK' },
	{ envName: 'SASK_ACCOUNT_KEY', credType: 'SASK' },
	{ envName: 'AZURE_TENANT_ID', credType: 'ADCC' },
	{ envName: 'AZURE_CLIENT_ID', credType: 'ADCC' },
	{ envName: 'AZURE_CLIENT_SECRET_ID', credType: 'ADCC' },
	{ envName: 'AUTH_METHOD', credType: 'invalid' },
])(
	'when $credType credential and $envName is invalid, it returns an err (EnvironmentError)',
	async ({ envName, credType }) => {
		// Arrange
		process.env.AUTH_METHOD = credType;
		process.env.AZURE_QUEUE_ACCOUNT_URI = queueAccountUri;

		process.env.SASK_ACCOUNT_NAME = credType === 'SASK' && envName === 'SASK_ACCOUNT_NAME' ? '' : 'accountName';
		process.env.SASK_ACCOUNT_KEY = credType === 'SASK' && envName === 'SASK_ACCOUNT_KEY' ? '' : 'accountKey';

		process.env.AZURE_TENANT_ID = credType === 'ADCC' && envName === 'AZURE_TENANT_ID' ? '' : 'tenant';
		process.env.AZURE_CLIENT_ID = credType === 'ADCC' && envName === 'AZURE_CLIENT_ID' ? '' : 'client';
		process.env.AZURE_CLIENT_SECRET_ID = credType === 'ADCC' && envName === 'AZURE_CLIENT_SECRET_ID' ? '' : 'secret';

		const messageText = `${envName} test`;
		const queueName = 'queueName';

		// Act
		const result = reproTest();
		console.log(credType, envName, result);

		// Assert
		expect(result.result).toBe('ok');
	}
);
