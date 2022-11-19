import path from 'path';
import { Logger } from 'pino';
import { delay } from '../../common/utils/utils';
import { IAzureQueueAdapter } from './IAzureQueueAdapter';
import { IQueueMessageHandler } from './IQueueMessageHandler';

export interface AzureQueueWatcherOptions {
	messageHandler: IQueueMessageHandler;
	queueAdapter: IAzureQueueAdapter;
	minDelayMs: number;
	maxDelayMs: number;
	delayIncrementMs: number;
	abortSignal: AbortSignal;
	logger: Logger;
	queueName: string;
}

const moduleName = path.basename(module.filename);

export class AzureQueueWatcher {
	private _runFlag: boolean;
	private _messageHandler: IQueueMessageHandler;
	private _queueAdapter: IAzureQueueAdapter;
	private _minDelayMs: number;
	private _maxDelayMs: number;
	private _abortSignal: AbortSignal;
	private _logger: Logger;
	private _queueName: string;
	private _delayMs: number;
	private _delayIncrementMs: number;

	public constructor(opts: AzureQueueWatcherOptions) {
		this._runFlag = false;
		this._messageHandler = opts.messageHandler;
		this._queueAdapter = opts.queueAdapter;
		this._minDelayMs = opts.minDelayMs;
		this._maxDelayMs = opts.maxDelayMs;
		this._abortSignal = opts.abortSignal;
		this._logger = opts.logger;
		this._queueName = opts.queueName;
		this._delayMs = this._minDelayMs;
		this._delayIncrementMs = opts.delayIncrementMs;
	}

	public isRunning() {
		return this._runFlag;
	}

	public startWatcher() {
		this._runFlag = true;
		this._watchQueue();
		this._logger.info(
			{ moduleName, functionName: 'startWatcher', queueName: this._queueAdapter.queueName },
			'Started queue watcher'
		);
	}

	public stopWatcher() {
		this._runFlag = false;
		this._logger.info(
			{ moduleName, functionName: 'startWatcher', queueName: this._queueAdapter.queueName },
			'Stopped queue watcher'
		);
	}

	private _getNextDelay() {
		return Math.min(this._delayMs + this._delayIncrementMs, this._maxDelayMs);
	}

	private async _watchQueue() {
		const functionName = 'watchQueue';

		while (this._runFlag) {
			const receiveResult = await this._queueAdapter.receive(1);

			// don't await here because it could delay a message going to the message handler long enough to expire the popReceipt
			if (receiveResult.isOk()) {
				const { messages, startTime, endTime } = receiveResult.value;

				messages.forEach((rcvMsg) => this._messageHandler.processMessage(rcvMsg));

				if (messages.length > 0) {
					this._logger.trace(
						{
							queueName: this._queueName,
							messageCount: messages.length,
							startTime,
							endTime,
							moduleName,
							functionName,
						},
						'Received queue messages'
					);
				}
			} else {
				this._logger.error({ error: receiveResult.error, moduleName, functionName }, 'Queue receive error');
			}

			const delayResult = await delay(this._delayMs, this._abortSignal);
			if (delayResult === 'AbortError') {
				this.stopWatcher();
			} else {
				this._delayMs = this._getNextDelay();
			}
		}
	}
}
