// mock the @azure/storage-queue module so we can replace functions in it for testing
jest.mock('@azure/storage-queue');
import * as mockQueueSDK from '@azure/storage-queue';

jest.mock('bullmq');
import * as bullMq from 'bullmq';

import { ReceivedMessageItem } from '@azure/storage-queue';

import { eventBus } from '../../../common/infrastructure/event-bus/eventBus';
import { CircuitBreakerWithRetry } from '../../../infrastructure/resilience/CircuitBreakerWithRetry';
import { delay } from '../../../common/utils/utils';

import { StoreStatusMessage } from '../../domain/StoreStatusReceived.common';
import { AzureBackupInterfaceStoreAdapter } from './AzureBackupInterfaceStoreAdapter';

import { AzureStoreStatusMessageHandler } from './AzureStoreStatusMessageHandler';

import { getLenientCircuitBreaker } from '../../../test-helpers/circuitBreakerHelpers';
import { setAppStateForAzureQueue, useSask } from '../../../test-helpers/AzureQueueTestHelpers';

const now = new Date();
const offsetMs = 15 * 60 * 1000;

describe('AzureStoreStatusMessageHandler', () => {
	let azureQueueCircuitBreaker: CircuitBreakerWithRetry;
	let abortController: AbortController;

	beforeEach(() => {
		// mockTypeormCtx = createMockTypeormContext();
		// typeormCtx = mockTypeormCtx as unknown as TypeormContext;

		abortController = new AbortController();
		// dbCircuitBreaker = getLenientCircuitBreaker('TypeORM', abortController.signal);
		azureQueueCircuitBreaker = getLenientCircuitBreaker('AzureQueue', abortController.signal);

		setAppStateForAzureQueue();
		useSask();
	});

	afterEach(() => {
		abortController.abort();
		delay(250);
	});

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
		const interfaceAdapter = new AzureBackupInterfaceStoreAdapter('test-queue', azureQueueCircuitBreaker, false);
		const msgHandler = new AzureStoreStatusMessageHandler(interfaceAdapter);
		const publishSpy = jest.spyOn(eventBus, 'publishEvent');

		// Act
		const result = await msgHandler.processMessage({ ...okMsgItem, messageText: 'bad json' });
		// console.log('test result', result);

		// Assert
		expect(result.isErr()).toBe(true);
		expect(publishSpy).toHaveBeenCalledTimes(0);
		if (result.isErr()) {
			expect(result.error.name).toBe('StatusJsonError');
			expect((result.error.errorData as any).messageId).toBe(okMsgItem.messageId);
		}
	});

	test('when messageText is valid JSON, it returns ok', async () => {
		// Arrange
		const interfaceAdapter = new AzureBackupInterfaceStoreAdapter('test-queue', azureQueueCircuitBreaker, false);
		const msgHandler = new AzureStoreStatusMessageHandler(interfaceAdapter);
		const publishSpy = jest.spyOn(eventBus, 'publishEvent');

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

describe('AzureBackupInterfaceStoreAdapter', () => {
	let azureQueueCircuitBreaker: CircuitBreakerWithRetry;
	let abortController: AbortController;

	beforeEach(() => {
		// mockTypeormCtx = createMockTypeormContext();
		// typeormCtx = mockTypeormCtx as unknown as TypeormContext;

		abortController = new AbortController();
		// dbCircuitBreaker = getLenientCircuitBreaker('TypeORM', abortController.signal);
		azureQueueCircuitBreaker = getLenientCircuitBreaker('AzureQueue', abortController.signal);

		setAppStateForAzureQueue();
		useSask();
	});

	afterEach(() => {
		abortController.abort();
		delay(250);
	});

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
		mockQueueSDK.QueueClient.prototype.receiveMessages = jest
			.fn()
			.mockRejectedValueOnce(new Error('simulated SDK Promise.reject()'));
		const receiveSpy = jest.spyOn(mockQueueSDK.QueueClient.prototype, 'receiveMessages');

		const storeAdapter = new AzureBackupInterfaceStoreAdapter('test-queue', azureQueueCircuitBreaker, false);

		// Act
		const result = await storeAdapter.receive(1);

		// Assert
		expect(result.isErr()).toBe(true);
		expect(receiveSpy).toHaveBeenCalledTimes(1);
		if (result.isErr()) {
			expect(result.error.name).toBe('SDKError');
		}
	});

	test('when receiveMessage returns messages, it returns ok with messages', async () => {
		// Arrange
		const rcvItems = [
			{ ...okMsgItem, messageText: 'message1' },
			{ ...okMsgItem, messageText: 'message2' },
			{ ...okMsgItem, messageText: 'message3' },
		];

		mockQueueSDK.QueueClient.prototype.receiveMessages = jest
			.fn()
			.mockResolvedValueOnce({ ...mockRcvOk, receivedMessageItems: rcvItems });
		const receiveSpy = jest.spyOn(mockQueueSDK.QueueClient.prototype, 'receiveMessages');

		const storeAdapter = new AzureBackupInterfaceStoreAdapter('test-queue', azureQueueCircuitBreaker, false);

		// Act
		const result = await storeAdapter.receive(1);

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

		// mockRcvOk has empty receivedMessageItems array
		mockQueueSDK.QueueClient.prototype.receiveMessages = jest.fn().mockResolvedValueOnce({ ...mockRcvOk });
		const receiveSpy = jest.spyOn(mockQueueSDK.QueueClient.prototype, 'receiveMessages');

		const storeAdapter = new AzureBackupInterfaceStoreAdapter('test-queue', azureQueueCircuitBreaker, false);

		// Act
		const result = await storeAdapter.receive(1);

		// Assert
		expect(result.isOk()).toBe(true);
		expect(receiveSpy).toHaveBeenCalledTimes(1);
		if (result.isOk()) {
			expect(result.value.messages.length).toBe(0);
		}
	});
});
