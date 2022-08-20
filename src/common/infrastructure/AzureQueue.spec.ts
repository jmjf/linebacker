// mock the @azure/storage-queue module so we can replace functions in it for testing
jest.mock('@azure/storage-queue');
import * as asq from '@azure/storage-queue';

import { AzureQueue } from './AzureQueue';

// some tests simulate HTTP call failures with long timeouts
jest.setTimeout(30 * 1000);

describe('AzureQueue', () => {
	// for ADCC tests, AZURE_QUEUE_ACCOUNT_URI must be a valid queue account URI
	const queueAccountUri = `https://test123.queue.core.windows.net`;

	describe('environment checks', () => {
		test.each([
			{ envName: 'SASK_ACCOUNT_NAME', credType: 'SASK' },
			{ envName: 'SASK_ACCOUNT_KEY', credType: 'SASK' },
			{ envName: 'AZURE_TENANT_ID', credType: 'ADCC' },
			{ envName: 'AZURE_CLIENT_ID', credType: 'ADCC' },
			{ envName: 'AZURE_CLIENT_SECRET_ID', credType: 'ADCC' },
			{ envName: 'AUTH_METHOD', credType: 'BadAuthMethod' },
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
				process.env.AZURE_CLIENT_SECRET_ID =
					credType === 'ADCC' && envName === 'AZURE_CLIENT_SECRET_ID' ? '' : 'secret';

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
			{ credType: 'ADCC', uri: 'https://test123.queue.core.windows.netB' },
			{ credType: 'SASK', uri: '' },
		])(
			'when AZURE_QUEUE_ACCOUNT_URI is invalid ($credType, $uri), it returns an err (EnvironmentError)',
			async ({ credType, uri }) => {
				// Arrange
				process.env.AUTH_METHOD = credType;
				process.env.AZURE_TENANT_ID = 'tenant';
				process.env.AZURE_CLIENT_ID = 'client';
				process.env.AZURE_CLIENT_SECRET_ID = 'secret';
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
			process.env.AZURE_QUEUE_ACCOUNT_URI = queueAccountUri; // not checked for SASK because SASK it local only

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
	});

	describe('sendMessage', () => {
		test('when messageText is invalid, it returns an err (InputError)', async () => {
			// Arrange
			process.env.AUTH_METHOD = 'SASK';
			process.env.SASK_ACCOUNT_NAME = 'accountName';
			process.env.SASK_ACCOUNT_KEY = 'accountKey';
			process.env.AZURE_QUEUE_ACCOUNT_URI = queueAccountUri; // not checked for SASK because SASK it local only
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

		test('when queueClient throws, it returns an err (SDKError)', async () => {
			// Arrange
			process.env.AUTH_METHOD = 'ADCC';
			process.env.AZURE_TENANT_ID = 'tenant';
			process.env.AZURE_CLIENT_ID = 'client';
			process.env.AZURE_CLIENT_SECRET_ID = 'secret';
			process.env.AZURE_QUEUE_ACCOUNT_URI = queueAccountUri; // not checked for SASK because SASK is local only
			const messageText = `QueueClient throws message`;
			const queueName = 'queueName';
			asq.QueueClient.prototype.sendMessage = jest.fn().mockImplementationOnce(() => {
				throw new Error('simulated SDK failure');
			});

			// Act

			const result = await AzureQueue.sendMessage(queueName, messageText);

			jest.resetAllMocks();
			// // Assert
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.name).toBe('SDKError');
				expect(result.error.message).toContain('simulated SDK failure');
			}
		});

		test('when queueClient Promise.rejects, it returns an err (SDKError)', async () => {
			// Arrange
			process.env.AUTH_METHOD = 'ADCC';
			process.env.AZURE_TENANT_ID = 'tenant';
			process.env.AZURE_CLIENT_ID = 'client';
			process.env.AZURE_CLIENT_SECRET_ID = 'secret';
			process.env.AZURE_QUEUE_ACCOUNT_URI = queueAccountUri; // not checked for SASK because SASK is local only
			const messageText = `QueueClient rejects promise`;
			const queueName = 'queueName';
			asq.QueueClient.prototype.sendMessage = jest
				.fn()
				.mockRejectedValueOnce(new Error('simulated SDK Promise.reject()'));

			// Act

			const result = await AzureQueue.sendMessage(queueName, messageText);

			jest.resetAllMocks();
			// // Assert
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.name).toBe('SDKError');
				expect(result.error.message).toContain('simulated SDK Promise.reject()');
			}
		});

		test('when queueClient Promise.resolves with status < 300, it returns an ok with isSent true', async () => {
			// Arrange
			process.env.AUTH_METHOD = 'ADCC';
			process.env.AZURE_TENANT_ID = 'tenant';
			process.env.AZURE_CLIENT_ID = 'client';
			process.env.AZURE_CLIENT_SECRET_ID = 'secret';
			process.env.AZURE_QUEUE_ACCOUNT_URI = queueAccountUri; // not checked for SASK because SASK is local only
			const messageText = `QueueClient rejects promise`;
			const queueName = 'queueName';

			const now = new Date();
			const mockResolve = {
				expiresOn: new Date(now.setDate(now.getDate() + 7)),
				insertedOn: now,
				messageId: 'mock message id',
				nextVisibleOn: now,
				popReceipt: 'mock pop receipt',
				requestId: 'mock queue request id',
				clientRequestId: 'mock client request id',
				date: now,
				version: '2009-09-19',
				errorCode: '',
				_response: { status: 200 },
			};
			asq.QueueClient.prototype.sendMessage = jest.fn().mockResolvedValueOnce(mockResolve);

			// Act

			const result = await AzureQueue.sendMessage(queueName, messageText);

			jest.resetAllMocks();
			// // Assert
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				// values from original response
				expect(result.value.messageId).toBe(mockResolve.messageId);
				expect(result.value.insertedOn.valueOf()).toBe(mockResolve.insertedOn.valueOf());
				// values we add
				expect(result.value.isSent).toBe(true);
				expect(result.value.responseStatus).toBe(mockResolve._response.status);
			} //
		});

		test('when queueClient Promise.resolves with status > 299, it returns an ok with isSent false', async () => {
			// Arrange
			process.env.AUTH_METHOD = 'ADCC';
			process.env.AZURE_TENANT_ID = 'tenant';
			process.env.AZURE_CLIENT_ID = 'client';
			process.env.AZURE_CLIENT_SECRET_ID = 'secret';
			process.env.AZURE_QUEUE_ACCOUNT_URI = queueAccountUri; // not checked for SASK because SASK is local only
			const messageText = `QueueClient rejects promise`;
			const queueName = 'queueName';

			const now = new Date();
			const mockResolve = {
				expiresOn: new Date(now.setDate(now.getDate() + 7)),
				insertedOn: now,
				messageId: 'mock message id',
				nextVisibleOn: now,
				popReceipt: 'mock pop receipt',
				requestId: 'mock queue request id',
				clientRequestId: 'mock client request id',
				date: now,
				version: '2009-09-19',
				errorCode: '',
				_response: { status: 401 },
			};
			asq.QueueClient.prototype.sendMessage = jest.fn().mockResolvedValueOnce(mockResolve);

			// Act

			const result = await AzureQueue.sendMessage(queueName, messageText);
			console.log('test result', result);

			jest.resetAllMocks();
			// // Assert
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				// values from original response
				expect(result.value.messageId).toBe(mockResolve.messageId);
				expect(result.value.insertedOn.valueOf()).toBe(mockResolve.insertedOn.valueOf());
				// values we add
				expect(result.value.isSent).toBe(false);
				expect(result.value.responseStatus).toBe(mockResolve._response.status);
			}
		});
	});
});
