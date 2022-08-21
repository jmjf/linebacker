// mock the @azure/storage-queue module so we can replace functions in it for testing
jest.mock('@azure/storage-queue');
import * as asq from '@azure/storage-queue';
import { toBase64 } from '../../utils/utils';

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
				const result = await AzureQueue.sendMessage({ queueName, messageText });

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
				const result = await AzureQueue.sendMessage({ queueName, messageText });

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
			const result = await AzureQueue.sendMessage({ queueName, messageText });

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
			const result = await AzureQueue.sendMessage({ queueName, messageText });
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

			const result = await AzureQueue.sendMessage({ queueName, messageText });

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

			const result = await AzureQueue.sendMessage({ queueName, messageText });

			jest.resetAllMocks();
			// // Assert
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.name).toBe('SDKError');
				expect(result.error.message).toContain('simulated SDK Promise.reject()');
			}
		});

		test('when queueClient Promise.resolves with status > 299, it returns an ok with isSent false', async () => {
			// Arrange
			process.env.AUTH_METHOD = 'ADCC';
			process.env.AZURE_TENANT_ID = 'tenant';
			process.env.AZURE_CLIENT_ID = 'client';
			process.env.AZURE_CLIENT_SECRET_ID = 'secret';
			process.env.AZURE_QUEUE_ACCOUNT_URI = queueAccountUri; // not checked for SASK because SASK is local only
			const messageText = `QueueClient resolves promise; http status > 299`;
			const queueName = 'queueName';

			const now = new Date();
			const mockSendError = {
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
				_response: {
					status: 401,
					request: {
						requestId: 'mock Azure request id',
					},
				},
			};
			asq.QueueClient.prototype.sendMessage = jest.fn().mockResolvedValueOnce(mockSendError);

			// Act

			const result = await AzureQueue.sendMessage({ queueName, messageText });

			jest.resetAllMocks();
			// // Assert
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				// values from original response
				expect(result.value.messageId).toBe(mockSendError.messageId);
				expect(result.value.insertedOn.valueOf()).toBe(mockSendError.insertedOn.valueOf());
				// values we add
				expect(result.value.isSent).toBe(false);
				expect(result.value.responseStatus).toBe(mockSendError._response.status);
				expect(result.value.sendRequestId).toBe(mockSendError._response.request.requestId);
			}
		});

		test('when queueClient Promise.resolves with status < 300, it returns an ok with isSent true (not Base64)', async () => {
			// Arrange
			process.env.AUTH_METHOD = 'ADCC';
			process.env.AZURE_TENANT_ID = 'tenant';
			process.env.AZURE_CLIENT_ID = 'client';
			process.env.AZURE_CLIENT_SECRET_ID = 'secret';
			process.env.AZURE_QUEUE_ACCOUNT_URI = queueAccountUri; // not checked for SASK because SASK is local only
			const messageText = `QueueClient resolves promise; staus < 300; not Base64`;
			const queueName = 'queueName';

			const now = new Date();
			const mockSendOk = {
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
				_response: {
					status: 201,
					request: {
						requestId: 'mock Azure request id',
					},
					bodyAsText: '',
				},
			};
			asq.QueueClient.prototype.sendMessage = jest.fn().mockImplementation((message: string) => {
				// Deep copy object
				const mockResult = JSON.parse(JSON.stringify(mockSendOk));
				// JSON stringify converts dates to strings, so make them dates again
				mockResult.expiresOn = new Date(mockResult.expiresOn);
				mockResult.insertedOn = new Date(mockResult.insertedOn);
				mockResult.nextVisibleOn = new Date(mockResult.nextVisibleOn);
				mockResult.date = new Date(mockResult.date);
				mockResult._response.bodyAsText = message;
				return mockResult;
			});

			// Act

			const result = await AzureQueue.sendMessage({ queueName, messageText });

			jest.resetAllMocks();
			// // Assert
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				// values from original response
				expect(result.value.messageId).toBe(mockSendOk.messageId);
				expect(result.value.insertedOn.valueOf()).toBe(mockSendOk.insertedOn.valueOf());
				// values we add
				expect(result.value.isSent).toBe(true);
				expect(result.value.responseStatus).toBe(mockSendOk._response.status);
				expect(result.value.sendRequestId).toBe(mockSendOk._response.request.requestId);
				// message not Base64 encoded
				expect(result.value._response.bodyAsText).toBe(messageText);
			}
		});

		test('when queueClient Promise.resolves with status < 300, it returns an ok with isSent true (Base64)', async () => {
			// Arrange
			process.env.AUTH_METHOD = 'ADCC';
			process.env.AZURE_TENANT_ID = 'tenant';
			process.env.AZURE_CLIENT_ID = 'client';
			process.env.AZURE_CLIENT_SECRET_ID = 'secret';
			process.env.AZURE_QUEUE_ACCOUNT_URI = queueAccountUri; // not checked for SASK because SASK is local only
			const messageText = `QueueClient resolves promise; status < 300; Base64`;
			const queueName = 'queueName';

			const now = new Date();
			const mockSendOk = {
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
				_response: {
					status: 201,
					request: {
						requestId: 'mock Azure request id',
					},
					bodyAsText: '',
				},
			};
			asq.QueueClient.prototype.sendMessage = jest.fn().mockImplementation((message: string) => {
				// Deep copy object
				const mockResult = JSON.parse(JSON.stringify(mockSendOk));
				// JSON stringify converts dates to strings, so make them dates again
				mockResult.expiresOn = new Date(mockResult.expiresOn);
				mockResult.insertedOn = new Date(mockResult.insertedOn);
				mockResult.nextVisibleOn = new Date(mockResult.nextVisibleOn);
				mockResult.date = new Date(mockResult.date);
				mockResult._response.bodyAsText = message;
				return mockResult;
			});

			// Act

			const result = await AzureQueue.sendMessage({ queueName, messageText, useBase64: true });

			jest.resetAllMocks();
			// // Assert
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				// values from original response
				expect(result.value.messageId).toBe(mockSendOk.messageId);
				expect(result.value.insertedOn.valueOf()).toBe(mockSendOk.insertedOn.valueOf());
				// values we add
				expect(result.value.isSent).toBe(true);
				expect(result.value.responseStatus).toBe(mockSendOk._response.status);
				expect(result.value.sendRequestId).toBe(mockSendOk._response.request.requestId);
				// message Base64 encoded
				expect(result.value._response.bodyAsText).toBe(toBase64(messageText));
			}
		});
	});
});
