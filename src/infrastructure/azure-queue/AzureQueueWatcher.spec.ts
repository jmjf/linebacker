// mock the @azure/storage-queue module so we can replace functions in it for testing
jest.mock('@azure/storage-queue');
import * as mockQueueSDK from '@azure/storage-queue';

// Using ABISA because it exists; for purposes of testing, it's fine
import { AzureBackupInterfaceStoreAdapter } from '../../backup-request/adapter/impl/AzureBackupInterfaceStoreAdapter';
import { CircuitBreakerWithRetry } from '../resilience/CircuitBreakerWithRetry';
import { getLenientCircuitBreaker } from '../../test-helpers/circuitBreakerHelpers';

import { AzureQueueWatcherOptions, AzureQueueWatcher } from './AzureQueueWatcher';
import { QueueMessageHandlerResponse } from './IQueueMessageHandler';
import { delay } from '../../common/utils/utils';
import { logger } from '../logging/pinoLogger';
import { ok } from '../../common/core/Result';

// some tests simulate HTTP call failures with long timeouts
jest.setTimeout(30 * 1000);

describe('AzureQueueWatcher', () => {
	let circuitBreaker: CircuitBreakerWithRetry;
	let abortController: AbortController;

	beforeEach(() => {
		jest.resetAllMocks();
		abortController = new AbortController();
		circuitBreaker = getLenientCircuitBreaker('AzureQueue', abortController.signal);
	});

	afterEach(async () => {
		abortController.abort();
		await delay(100);
	});

	const baseWatcherOpts = {
		messageHandler: {
			processMessage: async (message: any, opts?: any) => {
				// console.log('process', message); // uncomment to see output
				return Promise.resolve(ok(true));
			},
		},
		minDelayMs: 5,
		maxDelayMs: 20,
		delayIncrementMs: 5,
		logger,
		queueName: 'test',
	};

	const receiveResult = {
		receivedMessageItems: [{ messageText: 'message1' }],
		_response: {
			status: '200',
		},
	};

	// environment for AzureQueue
	process.env.AUTH_METHOD = 'SASK';
	process.env.SASK_ACCOUNT_NAME = 'accountName';
	process.env.SASK_ACCOUNT_KEY = 'accountKey';
	process.env.AZURE_QUEUE_ACCOUNT_URI = `https://test123.queue.core.windows.net`; // not checked for SASK because SASK is local only

	test('when startWatcher() is called, the queue watcher is running and starts calling receive', async () => {
		// Arrange
		mockQueueSDK.QueueClient.prototype.receiveMessages = jest.fn().mockResolvedValue(receiveResult);

		const queueAdapter = new AzureBackupInterfaceStoreAdapter('testQueue', circuitBreaker, false);
		const receiveSpy = jest.spyOn(queueAdapter, 'receive');

		const queueWatcher = new AzureQueueWatcher({
			...baseWatcherOpts,
			abortSignal: abortController.signal,
			queueAdapter,
		});

		// precondition
		expect(queueWatcher.isRunning()).toBe(false);
		expect(receiveSpy).not.toHaveBeenCalled();

		// Act
		queueWatcher.startWatcher();
		await delay(25);

		// Assert
		expect(queueWatcher.isRunning()).toBe(true);
		expect(receiveSpy).toHaveBeenCalled();
	});

	test('when stopWatcher() is called, the queue watcher is not running and stops calling receive', async () => {
		// Arrange
		mockQueueSDK.QueueClient.prototype.receiveMessages = jest.fn().mockResolvedValue(receiveResult);

		const queueAdapter = new AzureBackupInterfaceStoreAdapter('testQueue', circuitBreaker, false);
		const receiveSpy = jest.spyOn(queueAdapter, 'receive');

		const queueWatcher = new AzureQueueWatcher({
			...baseWatcherOpts,
			abortSignal: abortController.signal,
			queueAdapter,
		});

		// precondition -- watcher must be running to test stop
		queueWatcher.startWatcher();
		await delay(25);

		expect(queueWatcher.isRunning()).toBe(true);
		expect(receiveSpy).toHaveBeenCalled();

		// Act
		receiveSpy.mockClear(); // reset call counts to 0
		queueWatcher.stopWatcher();
		// no new calls should run
		await delay(25);

		// Assert
		expect(queueWatcher.isRunning()).toBe(false);
		expect(receiveSpy).not.toHaveBeenCalled();
	});

	test('when AbortController signals, the queue watcher stops running and stops calling receive', async () => {
		// Arrange
		mockQueueSDK.QueueClient.prototype.receiveMessages = jest.fn().mockResolvedValue(receiveResult);

		const queueAdapter = new AzureBackupInterfaceStoreAdapter('testQueue', circuitBreaker, false);
		const receiveSpy = jest.spyOn(queueAdapter, 'receive');

		const queueWatcher = new AzureQueueWatcher({
			...baseWatcherOpts,
			abortSignal: abortController.signal,
			queueAdapter,
		});

		// precondition -- watcher must be running to test stop
		queueWatcher.startWatcher();
		await delay(25);

		expect(queueWatcher.isRunning()).toBe(true);
		expect(receiveSpy).toHaveBeenCalled();

		// Act
		receiveSpy.mockClear(); // reset call counts to 0
		abortController.abort();
		// no new calls should run
		await delay(50);

		// Assert
		expect(queueWatcher.isRunning()).toBe(false);
		expect(receiveSpy).not.toHaveBeenCalled();
	});

	test('when watch loop runs, the message handler is called', async () => {
		// Arrange
		mockQueueSDK.QueueClient.prototype.receiveMessages = jest.fn().mockResolvedValue(receiveResult);

		const queueAdapter = new AzureBackupInterfaceStoreAdapter('testQueue', circuitBreaker, false);
		const receiveSpy = jest.spyOn(queueAdapter, 'receive');

		const processMessageSpy = jest.spyOn(baseWatcherOpts.messageHandler, 'processMessage');

		const queueWatcher = new AzureQueueWatcher({
			...baseWatcherOpts,
			abortSignal: abortController.signal,
			queueAdapter,
		});

		// Act
		queueWatcher.startWatcher();
		await delay(25);

		// Assert
		expect(queueWatcher.isRunning()).toBe(true);
		expect(processMessageSpy).toHaveBeenCalled();
	});
});
