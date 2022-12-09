// mock the @azure/storage-queue module so we can replace functions in it for testing
jest.mock('@azure/storage-queue');
import * as mockQueueSDK from '@azure/storage-queue';

import { appState } from '../app-state/appState';

import { toBase64 } from '../../common/utils/utils';

import { AzureQueue } from './AzureQueue';

import { useArcs, useSask, setAppStateForAzureQueue } from '../../test-helpers/AzureQueueTestHelpers';

// some tests simulate HTTP call failures with long timeouts
jest.setTimeout(30 * 1000);

describe('AzureQueue', () => {
	const now = new Date();
	const oneWeekMs = 7 * 24 * 60 * 1000;

	beforeEach(() => {
		jest.resetAllMocks();
		setAppStateForAzureQueue();
	});

	describe('environment checks', () => {
		test('when authMethod is not defined, it returns an err (EnvironmentError)', async () => {
			// Arrange
			appState.azureQueue_authMethod = '';

			// Act
			const result = await AzureQueue.sendMessage({ queueName: 'test-queue', messageText: 'test-message' });

			// Assert
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.name).toBe('EnvironmentError');
				expect(result.error.message.toLowerCase()).toContain('unusable auth method');
			}
		});

		test('when authMethod is invalid, it returns an err (EnvironmentError)', async () => {
			// Arrange
			appState.azureQueue_authMethod = 'invalid auth method';

			// Act
			const result = await AzureQueue.sendMessage({ queueName: 'test-queue', messageText: 'test-message' });

			// Assert
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.name).toBe('EnvironmentError');
				expect(result.error.message.toLowerCase()).toContain('invalid auth method');
			}
		});

		test.each([
			{ memberName: 'azureQueue_saskAccountName', authMethod: 'SASK' },
			{ memberName: 'azureQueue_saskAccountKey', authMethod: 'SASK' },
			{ memberName: 'azureQueue_arcsTenantId', authMethod: 'ARCS' },
			{ memberName: 'azureQueue_arcsClientId', authMethod: 'ARCS' },
			{ memberName: 'azureQueue_arcsClientSecret', authMethod: 'ARCS' },
		])(
			'when $authMethod credential and $memberName is invalid, it returns an err (EnvironmentError)',
			async ({ memberName, authMethod }) => {
				// Arrange
				if (authMethod.toLowerCase() === 'sask') {
					useSask();
				} else {
					useArcs();
				}
				(appState as Record<string, any>)[memberName] = '';

				const messageText = `${memberName} test`;
				const queueName = 'queueName';

				// Act
				const result = await AzureQueue.sendMessage({ queueName, messageText });

				// Assert
				expect(result.isErr()).toBe(true);
				if (result.isErr()) {
					expect(result.error.name).toBe('EnvironmentError');
					expect((result.error.errorData as any).missingMembers).toContain(memberName);
				}
			}
		);

		test.each([
			{ authMethod: 'ARCS', uri: '' },
			{ authMethod: 'ARCS', uri: 'http://nope.nowhere.com' },
			{ authMethod: 'ARCS', uri: 'https://12.queue.core.windows.net' },
			{ authMethod: 'ARCS', uri: 'https://test123.queue.core.windows.netB' },
			{ authMethod: 'SASK', uri: '' },
		])(
			'when account URI is invalid ($authMethod, $uri), it returns an err (EnvironmentError)',
			async ({ authMethod, uri }) => {
				// Arrange
				appState.azureQueue_authMethod = authMethod;
				appState.azureQueue_queueAccountUri = uri;

				const messageText = `azureQueue_queueAccountUri test ${authMethod}`;
				const queueName = 'queueName';

				// Act
				const result = await AzureQueue.sendMessage({ queueName, messageText });

				// Assert
				expect(result.isErr()).toBe(true);
				if (result.isErr()) {
					expect(result.error.name).toBe('EnvironmentError');
					expect((result.error.errorData as any).queueAccountUri).toMatch(uri);
				}
			}
		);

		test('when queueName is invalid, it returns an err (InputError)', async () => {
			// Arrange
			useSask();

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
		const mockSendOk = {
			expiresOn: new Date(now.valueOf() + oneWeekMs),
			insertedOn: new Date(now.valueOf() - oneWeekMs),
			messageId: 'mock message id',
			nextVisibleOn: new Date(now.valueOf() + 30 * 1000),
			popReceipt: 'mock pop receipt',
			requestId: 'mock queue request id',
			clientRequestId: 'mock client request id',
			date: now,
			version: '2020-09-19',
			errorCode: '',
			_response: {
				status: 201,
				request: {
					requestId: 'mock Azure request id',
				},
				parsedBody: [],
			},
		};

		const mockSendError = {
			expiresOn: new Date(now.setDate(now.getDate() + 7)),
			insertedOn: now,
			messageId: 'mock message id',
			nextVisibleOn: now,
			popReceipt: 'mock pop receipt',
			requestId: 'mock queue request id',
			clientRequestId: 'mock client request id',
			date: now,
			version: '2020-09-19',
			errorCode: '',
			_response: {
				status: 401,
				request: {
					requestId: 'mock Azure request id',
				},
			},
		};

		test('when messageText is invalid, it returns an err (InputError)', async () => {
			// Arrange
			useSask();

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
			useArcs();

			const messageText = `QueueClient throws message`;
			const queueName = 'queueName';
			mockQueueSDK.QueueClient.prototype.sendMessage = jest.fn().mockImplementationOnce(() => {
				throw new Error('simulated thrown error');
			});

			// Act
			const result = await AzureQueue.sendMessage({ queueName, messageText });

			// Assert
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.name).toBe('SDKError');
				expect(result.error.message).toContain('simulated thrown error');
			}
		});

		test('when queueClient Promise.rejects, it returns an err (SDKError)', async () => {
			// Arrange
			useArcs();

			const messageText = `QueueClient rejects promise`;
			const queueName = 'queueName';
			mockQueueSDK.QueueClient.prototype.sendMessage = jest
				.fn()
				.mockRejectedValueOnce(new Error('simulated SDK Promise.reject()'));

			// Act
			const result = await AzureQueue.sendMessage({ queueName, messageText });

			// Assert
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.name).toBe('SDKError');
				expect(result.error.message).toContain('simulated SDK Promise.reject()');
			}
		});

		test('when queueClient Promise.resolves with status > 299, it returns an ok with isSent false', async () => {
			// Arrange
			useArcs();

			const messageText = `QueueClient resolves promise; http status > 299`;
			const queueName = 'queueName';

			mockQueueSDK.QueueClient.prototype.sendMessage = jest.fn().mockResolvedValueOnce(mockSendError);

			// Act
			const result = await AzureQueue.sendMessage({ queueName, messageText });

			// Assert
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				// values from original response
				expect(result.value.messageId).toBe(mockSendError.messageId);
				expect(result.value.insertedOn.valueOf()).toBe(mockSendError.insertedOn.valueOf());
				// values we add
				expect(result.value.isSent).toBe(false);
				expect(result.value.responseStatus).toBe(mockSendError._response.status);
			}
		});

		test('when queueClient Promise.resolves with status < 300, it returns an ok with isSent true (not Base64)', async () => {
			// Arrange
			useArcs();

			const messageText = `QueueClient resolves promise; staus < 300; not Base64`;
			const queueName = 'queueName';

			mockQueueSDK.QueueClient.prototype.sendMessage = jest.fn().mockImplementation((message: string) => {
				// Deep copy object so we don't affect other tests
				const mockResult = JSON.parse(JSON.stringify(mockSendOk));
				// JSON stringify converts dates to strings, so make them dates again
				mockResult.expiresOn = new Date(mockResult.expiresOn);
				mockResult.insertedOn = new Date(mockResult.insertedOn);
				mockResult.nextVisibleOn = new Date(mockResult.nextVisibleOn);
				mockResult.date = new Date(mockResult.date);
				mockResult._response.parsedBody.push(message);
				return mockResult;
			});

			// Act
			const result = await AzureQueue.sendMessage({ queueName, messageText });

			// Assert
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				// values from original response
				expect(result.value.messageId).toBe(mockSendOk.messageId);
				expect(result.value.insertedOn.valueOf()).toBe(mockSendOk.insertedOn.valueOf());
				// values we add
				expect(result.value.isSent).toBe(true);
				expect(result.value.responseStatus).toBe(mockSendOk._response.status);
				// message is not Base64 encoded
				expect(result.value._response.parsedBody[0]).toBe(messageText);
			}
		});

		test('when queueClient Promise.resolves with status < 300, it returns an ok with isSent true (Base64)', async () => {
			// Arrange
			useArcs();

			const messageText = `QueueClient resolves promise; status < 300; Base64`;
			const queueName = 'queueName';

			mockQueueSDK.QueueClient.prototype.sendMessage = jest.fn().mockImplementation((message: string) => {
				// Deep copy object
				const mockResult = JSON.parse(JSON.stringify(mockSendOk));
				// JSON stringify converts dates to strings, so make them dates again
				mockResult.expiresOn = new Date(mockResult.expiresOn);
				mockResult.insertedOn = new Date(mockResult.insertedOn);
				mockResult.nextVisibleOn = new Date(mockResult.nextVisibleOn);
				mockResult.date = new Date(mockResult.date);
				mockResult._response.parsedBody.push(message);
				return mockResult;
			});

			// Act
			const result = await AzureQueue.sendMessage({ queueName, messageText, useBase64: true });

			// Assert
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				// values from original response
				expect(result.value.messageId).toBe(mockSendOk.messageId);
				expect(result.value.insertedOn.valueOf()).toBe(mockSendOk.insertedOn.valueOf());
				// values we add
				expect(result.value.isSent).toBe(true);
				expect(result.value.responseStatus).toBe(mockSendOk._response.status);
				// message Base64 encoded
				expect(result.value._response.parsedBody[0]).toBe(toBase64(messageText));
			}
		});
	});

	describe('receiveMessages', () => {
		const mockReceiveOk = {
			receivedMessageItems: [] as mockQueueSDK.ReceivedMessageItem[],
			requestId: 'request-id',
			version: '2022-08-15',
			date: now,
			_response: {
				status: 200,
			},
		};

		const messageItem = {
			dequeueCount: 0,
			expiresOn: new Date(now.valueOf() + oneWeekMs),
			insertedOn: new Date(now.valueOf() - oneWeekMs),
			messageId: 'mock-messageid',
			nextVisibleOn: new Date(now.valueOf() + 30 * 1000),
			popReceipt: 'pop-receipt',
		};

		test('when queueClient throws, it returns an err (SDKError)', async () => {
			// Arrange
			useArcs();

			const queueName = 'queueName';

			mockQueueSDK.QueueClient.prototype.receiveMessages = jest.fn().mockImplementationOnce(() => {
				throw new Error('simulated thrown error');
			});

			// Act
			const result = await AzureQueue.receiveMessages({ queueName, messageCount: 1 });

			jest.resetAllMocks();
			// // Assert
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.name).toBe('SDKError');
				expect(result.error.message).toContain('simulated thrown error');
			}
		});

		test('when queueClient Promise.rejects, it returns an err (SDKError)', async () => {
			// Arrange
			useArcs();
			const queueName = 'queueName';

			mockQueueSDK.QueueClient.prototype.receiveMessages = jest
				.fn()
				.mockRejectedValueOnce(new Error('simulated SDK Promise.reject()'));

			// Act
			const result = await AzureQueue.receiveMessages({ queueName, messageCount: 1 });

			jest.resetAllMocks();
			// // Assert
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.name).toBe('SDKError');
				expect(result.error.message).toContain('simulated SDK Promise.reject()');
			}
		});

		test('when queueClient Promise.resolves with status < 300, it returns an ok with a message (not Base64)', async () => {
			// Arrange
			useArcs();
			const messageText = `QueueClient resolves promise; status < 300; not Base64`;
			const queueName = 'queueName';

			mockQueueSDK.QueueClient.prototype.receiveMessages = jest.fn().mockImplementation(() => {
				// Deep copy object so we don't affect other tests
				const mockResult = JSON.parse(JSON.stringify(mockReceiveOk));
				// JSON stringify converts dates to strings, so make them dates again
				mockResult.date = new Date(mockResult.date);
				mockResult.receivedMessageItems.push({ ...messageItem, messageText });
				return mockResult;
			});

			// Act
			const result = await AzureQueue.receiveMessages({ queueName, messageCount: 1 });

			// Assert
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.responseStatus).toBe(mockReceiveOk._response.status);
				expect(result.value.requestId).toBe(mockReceiveOk.requestId);

				expect(result.value.receivedMessageItems.length).toBe(1);
				expect(result.value.receivedMessageItems[0].messageId).toBe(messageItem.messageId);
				expect(result.value.receivedMessageItems[0].messageText).toBe(messageText);
			}
		});

		test('when queueClient Promise.resolves with status < 300, it returns an ok with a message (Base64)', async () => {
			// Arrange
			useArcs();
			const messageText = `QueueClient resolves promise; status < 300; Base64`;
			const queueName = 'queueName';

			mockQueueSDK.QueueClient.prototype.receiveMessages = jest.fn().mockImplementation(() => {
				// Deep copy object so we don't affect other tests
				const mockResult = JSON.parse(JSON.stringify(mockReceiveOk));
				// JSON stringify converts dates to strings, so make them dates again
				mockResult.date = new Date(mockResult.date);
				mockResult.receivedMessageItems.push({ ...messageItem, messageText: toBase64(messageText) });
				return mockResult;
			});

			// Act
			const result = await AzureQueue.receiveMessages({ queueName, messageCount: 1, useBase64: true });

			// Assert
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.responseStatus).toBe(mockReceiveOk._response.status);
				expect(result.value.requestId).toBe(mockReceiveOk.requestId);

				expect(result.value.receivedMessageItems.length).toBe(1);
				expect(result.value.receivedMessageItems[0].messageId).toBe(messageItem.messageId);
				// receive should decode Base64 before returning
				expect(result.value.receivedMessageItems[0].messageText).toBe(messageText);
			}
		});

		test('when queueClient Promise.resolves with status < 300, it returns an ok with no message (no messages)', async () => {
			// Arrange
			useArcs();
			const queueName = 'queueName';

			mockQueueSDK.QueueClient.prototype.receiveMessages = jest.fn().mockImplementation(() => {
				// Deep copy object so we don't affect other tests
				const mockResult = JSON.parse(JSON.stringify(mockReceiveOk));
				// JSON stringify converts dates to strings, so make them dates again
				mockResult.date = new Date(mockResult.date);
				mockResult.receivedMessageItems = [];
				return mockResult;
			});

			// Act
			const result = await AzureQueue.receiveMessages({ queueName, messageCount: 1 });

			// Assert
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.responseStatus).toBe(mockReceiveOk._response.status);
				expect(result.value.requestId).toBe(mockReceiveOk.requestId);

				expect(result.value.receivedMessageItems.length).toBe(0);
			}
		});
	});

	describe('deleteMessage', () => {
		const mockDeleteOk = {
			requestId: 'request-id',
			version: '2022-08-15',
			date: now,
			_response: {
				status: 200,
			},
		};

		const messageId = 'mock-messageid';
		const popReceipt = 'pop-receipt';

		test('when queueClient throws, it returns an err (SDKError)', async () => {
			// Arrange
			useArcs();
			const queueName = 'queueName';

			mockQueueSDK.QueueClient.prototype.deleteMessage = jest.fn().mockImplementationOnce(() => {
				throw new Error('simulated thrown error');
			});

			// Act
			const result = await AzureQueue.deleteMessage({ queueName, messageId, popReceipt });

			jest.resetAllMocks();
			// // Assert
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.name).toBe('SDKError');
				expect(result.error.message).toContain('simulated thrown error');
			}
		});

		test('when queueClient Promise.rejects, it returns an err (SDKError)', async () => {
			// Arrange
			useArcs();
			const queueName = 'queueName';

			mockQueueSDK.QueueClient.prototype.deleteMessage = jest
				.fn()
				.mockRejectedValueOnce(new Error('simulated SDK Promise.reject()'));

			// Act
			const result = await AzureQueue.deleteMessage({ queueName, messageId, popReceipt });

			jest.resetAllMocks();
			// // Assert
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.name).toBe('SDKError');
				expect(result.error.message).toContain('simulated SDK Promise.reject()');
			}
		});

		test('when queueClient Promise.resolves with status < 300, it returns an ok', async () => {
			// Arrange
			useArcs();
			const queueName = 'queueName';

			mockQueueSDK.QueueClient.prototype.deleteMessage = jest.fn().mockResolvedValue(mockDeleteOk);

			// Act
			const result = await AzureQueue.deleteMessage({ queueName, messageId, popReceipt });

			// Assert
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.responseStatus).toBe(mockDeleteOk._response.status);
				expect(result.value.requestId).toBe(mockDeleteOk.requestId);
			}
		});
	});
});
