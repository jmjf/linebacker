// mock the @azure/storage-queue module so we can replace functions in it for testing
jest.mock('@azure/storage-queue');
import * as mockQueueSDK from '@azure/storage-queue';

import { ReceivedMessageItem } from '@azure/storage-queue';

import { DomainEventBus } from '../../../common/domain/DomainEventBus';

import { StoreStatusMessage } from '../../domain/StoreStatusReceived';
import { AzureBackupInterfaceStoreAdapter } from './AzureBackupInterfaceStoreAdapter';

import { AzureStoreStatusMessageHandler } from './AzureStoreStatusMessageHandler';

const now = new Date();
const offsetMs = 15 * 60 * 1000;

describe('AzureStoreStatusMessageHandler -- will move to receive status use case tests later', () => {
	const msgObject: StoreStatusMessage = {
		apiVersion: '2022-08-15',
		backupRequestId: 'msg-backup-request-id',
		storagePathName: 'msg-data-stored-at',
		resultTypeCode: 'Succeeded',
		backupByteCount: 123456789,
		copyStartTimestamp: new Date(now.valueOf() - offsetMs).toISOString(),
		copyEndTimestamp: new Date(now.valueOf() - 20 * 1000).toISOString(),
	};

	const okMsgItem: ReceivedMessageItem = {
		dequeueCount: 1,
		expiresOn: new Date(now.valueOf() + offsetMs * 40),
		insertedOn: new Date(now.valueOf() - 15 * 1000),
		messageId: 'item-message-id',
		messageText: JSON.stringify(msgObject),
		nextVisibleOn: new Date(now.valueOf() + 60 * 1000),
		popReceipt: 'item-pop-receipt',
	};

	test('when messageText is not valid JSON, it returns err (StatusJsonError)', async () => {
		// Arrange
		const msgHandler = new AzureStoreStatusMessageHandler();
		const publishSpy = jest.spyOn(DomainEventBus, 'publishToSubscribers');

		// Act
		const result = await msgHandler.processMessage({ ...okMsgItem, messageText: 'bad json' });
		// console.log('test result', result);

		// Assert
		expect(result.isErr()).toBe(true);
		expect(publishSpy).toHaveBeenCalledTimes(0);
		if (result.isErr()) {
			expect(result.error.name).toBe('StatusJsonError');
			expect(result.error.message).toContain(okMsgItem.messageId);
		}
	});

	test('when messageText is valid JSON, it returns ok', async () => {
		// Arrange
		const msgHandler = new AzureStoreStatusMessageHandler();
		const publishSpy = jest.spyOn(DomainEventBus, 'publishToSubscribers');

		// Act
		const result = await msgHandler.processMessage({ ...okMsgItem });

		// Assert
		expect(result.isOk()).toBe(true);
		expect(publishSpy).toHaveBeenCalledTimes(1);
		if (result.isOk()) {
			expect(result.value).toBe(true);
		}
	});
});

describe('AzureBackupInterfaceStoreAdapter -- will move to receive status use case later', () => {
	const okMsgItem: ReceivedMessageItem = {
		dequeueCount: 1,
		expiresOn: new Date(now.valueOf() + offsetMs * 40),
		insertedOn: new Date(now.valueOf() - 15 * 1000),
		messageId: 'item-message-id',
		messageText: '',
		nextVisibleOn: new Date(now.valueOf() + 60 * 1000),
		popReceipt: 'item-pop-receipt',
	};

	const mockRcvOk = {
		receivedMessageItems: [],
		requestId: 'mock queue request id',
		clientRequestId: 'mock client request id',
		date: new Date(),
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

	beforeEach(() => {
		jest.resetAllMocks();
	});

	test('when receiveMessage fails, it returns an err (InterfaceAdapterError)', async () => {
		// Arrange

		// env for AzureQueue
		process.env.AUTH_METHOD = 'SASK';
		process.env.SASK_ACCOUNT_NAME = 'accountName';
		process.env.SASK_ACCOUNT_KEY = 'accountKey';
		process.env.AZURE_QUEUE_ACCOUNT_URI = 'test-uri'; // not checked for SASK because SASK is local only

		mockQueueSDK.QueueClient.prototype.receiveMessages = jest
			.fn()
			.mockRejectedValueOnce(new Error('simulated SDK Promise.reject()'));
		const receiveSpy = jest.spyOn(mockQueueSDK.QueueClient.prototype, 'receiveMessages');

		const storeAdapter = new AzureBackupInterfaceStoreAdapter('test-queue', false);

		// Act
		const result = await storeAdapter.receive(1);

		// Assert
		expect(result.isErr()).toBe(true);
		expect(receiveSpy).toHaveBeenCalledTimes(1);
		if (result.isErr()) {
			expect(result.error.name).toBe('InterfaceAdapterError');
			expect(result.error.message).toContain('SDKError');
		}
	});

	test('when receiveMessage returns messages, it returns ok with messages', async () => {
		// Arrange

		// env for AzureQueue
		process.env.AUTH_METHOD = 'SASK';
		process.env.SASK_ACCOUNT_NAME = 'accountName';
		process.env.SASK_ACCOUNT_KEY = 'accountKey';
		process.env.AZURE_QUEUE_ACCOUNT_URI = 'test-uri'; // not checked for SASK because SASK is local only

		const rcvItems = [
			{ ...okMsgItem, messageText: 'message1' },
			{ ...okMsgItem, messageText: 'message2' },
			{ ...okMsgItem, messageText: 'message3' },
		];

		mockQueueSDK.QueueClient.prototype.receiveMessages = jest
			.fn()
			.mockResolvedValueOnce({ ...mockRcvOk, receivedMessageItems: rcvItems });
		const receiveSpy = jest.spyOn(mockQueueSDK.QueueClient.prototype, 'receiveMessages');

		const storeAdapter = new AzureBackupInterfaceStoreAdapter('test-queue', false);

		// Act
		const result = await storeAdapter.receive(1);
		console.log('ABISA receive ok 3 result', result);

		// Assert
		expect(result.isOk()).toBe(true);
		expect(receiveSpy).toHaveBeenCalledTimes(1);
		if (result.isOk()) {
			const msgs = result.value.messages as ReceivedMessageItem[];
			expect(msgs.length).toBe(3);
			expect(msgs[1].messageText).toBe('message2');
		}
	});

	test('when receiveMessage returns no messages, it returns ok with no messages', async () => {
		// Arrange

		// env for AzureQueue
		process.env.AUTH_METHOD = 'SASK';
		process.env.SASK_ACCOUNT_NAME = 'accountName';
		process.env.SASK_ACCOUNT_KEY = 'accountKey';
		process.env.AZURE_QUEUE_ACCOUNT_URI = 'test-uri'; // not checked for SASK because SASK is local only

		// mockRcvOk has empty receivedMessageItems array
		mockQueueSDK.QueueClient.prototype.receiveMessages = jest.fn().mockResolvedValueOnce({ ...mockRcvOk });
		const receiveSpy = jest.spyOn(mockQueueSDK.QueueClient.prototype, 'receiveMessages');

		const storeAdapter = new AzureBackupInterfaceStoreAdapter('test-queue', false);

		// Act
		const result = await storeAdapter.receive(1);
		console.log('ABISA receive ok 0 result', result);

		// Assert
		expect(result.isOk()).toBe(true);
		expect(receiveSpy).toHaveBeenCalledTimes(1);
		if (result.isOk()) {
			expect(result.value.messages.length).toBe(0);
		}
	});
});
