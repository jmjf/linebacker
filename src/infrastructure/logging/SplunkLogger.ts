import got from 'got/dist/source';
import SonicBoom from 'sonic-boom';
import os from 'node:os';
import { delay } from '../../common/utils/utils';

export interface SplunkLoggerOptions {
	url: string;
	splunkToken: string;
	sourceType?: string;
	logLevel?: number;
	logLevelKey?: string;
	logLevelNameKey?: string;
	levelMap?: Map<number, string>;
	maxBatchBytes?: number;
	maxBatchItems?: number;
	maxBatchWaitMs?: number;
	postTimeoutMs?: number;
	maxPostRetries?: number;
	maxPostItems?: number;
	maxPostErrorsToSplunk?: number;
	formatLog?: (event: object, logLevelKey?: string) => { logLevel: number | string; event: object };
	// event is really a superset of { time: number, source: string, host: string, severity: string }
	// but ts4.8 can't express that
}

interface HttpPostOptions {
	url: string;
	headers: Record<string, any>;
	body: string;
	maxPostRetries: number;
	postTimeoutMs: number;
}

export class SplunkLogger {
	private _url: string;
	private _splunkToken: string;
	private _sourceType: string;
	private _logLevel: number;
	private _levelMap: Map<number, string>;
	private _logLevelKey: string;
	private _logLevelNameKey: string;
	private _maxBatchBytes: number;
	private _maxBatchItems: number;
	private _maxBatchWaitMs: number;

	private _postTimeoutMs: number;
	private _maxPostRetries: number;
	private _maxPostItems: number;
	private _maxPostErrorsToSplunk: number;

	private _headers: Record<string, any> = {};

	private _inQueueSize = 0;
	private _inQueue: string[] = [];
	private _inQueueTimeout: ReturnType<typeof setTimeout>;

	private _outQueue: string[] = [];
	// outQueue isn't governed by size or timeout
	private _postErrorCount = 0;
	private _isQueueFlushing = false;

	private _stdout: SonicBoom;

	constructor(stdout: SonicBoom, opts: SplunkLoggerOptions) {
		this._stdout = stdout;
		if (!opts || !opts.url || !opts.splunkToken) throw new Error('buildSplunkAdapter missing required options');

		this._url = opts.url;
		this._splunkToken = opts.splunkToken;
		this._sourceType = opts.sourceType || '_json';
		this._logLevel = opts.logLevel || 0; // default is log everything it gets
		this._logLevelKey = opts.logLevelKey || 'level';
		this._logLevelNameKey = opts.logLevelNameKey || this._logLevelKey;

		this._levelMap =
			opts.levelMap && opts.levelMap instanceof Map
				? opts.levelMap
				: new Map([
						[60, 'fatal'],
						[50, 'error'],
						[40, 'warning'],
						[30, 'info'],
						[20, 'debug'],
						[10, 'trace'],
				  ]);

		// these configuration parameters are related
		// if any one is configured, default to -1 (ignore), else default to "always post"
		this._maxBatchBytes =
			opts.maxBatchBytes || opts.maxBatchItems || opts.maxBatchWaitMs ? opts.maxBatchBytes || -1 : 0;
		this._maxBatchItems =
			opts.maxBatchBytes || opts.maxBatchItems || opts.maxBatchWaitMs ? opts.maxBatchItems || -1 : 1;
		this._maxBatchWaitMs =
			opts.maxBatchBytes || opts.maxBatchItems || opts.maxBatchWaitMs ? opts.maxBatchWaitMs || -1 : 0;

		this._maxPostRetries = opts.maxPostRetries || 5;
		this._postTimeoutMs = opts.postTimeoutMs || 2000;
		this._maxPostItems = opts.maxPostItems || 200;
		this._maxPostErrorsToSplunk = opts.maxPostErrorsToSplunk || 5;

		this._headers['Content-Type'] = 'application/x-www-form-urlencoded';
		this._headers['Authorization'] = `Splunk ${this._splunkToken}`;
	}

	private _resetTimeoutIfNotRunning() {
		// if the timeout is already running
		if (this._inQueueTimeout) return;

		this._inQueueTimeout = setTimeout(this.flushQueue, this._maxBatchWaitMs);
	}

	private _getLogLevelName(level: string | number) {
		if (typeof level !== 'string' && typeof level !== 'number') return 'unknown';

		if (typeof level === 'string' && isNaN(parseInt(level))) return level;

		// level is either a string that parses to an integer or a number
		return this._levelMap.get(typeof level === 'string' ? parseInt(level) : level) || 'unknown';
	}

	private _getSplunkTime(time?: string | Date) {
		const timeToUse = time ? new Date(time) : new Date();
		return timeToUse.valueOf() / 1000;
	}

	private _formatLog(event: any) {
		if (typeof event !== 'object') return { level: 999, event: { event } };

		const { time, name, host, ...restOfEvent } = event;
		const splunkTime = this._getSplunkTime(time);
		// ensures a reliable log level name field
		const severity = this._getLogLevelName(event[this._logLevelNameKey]);

		return {
			logLevel: event[this._logLevelKey],
			event: {
				time: splunkTime,
				source: name || 'unknown',
				host: host || os.hostname(),
				sourcetype: this._sourceType,
				event: {
					...restOfEvent,
					time,
					severity,
				},
			},
		};
	}

	// http
	private async _postToSplunk({ url, headers, body, maxPostRetries, postTimeoutMs }: HttpPostOptions) {
		return got(url, {
			method: 'POST',
			headers,
			body,
			retry: { methods: ['POST'], limit: maxPostRetries },
			timeout: postTimeoutMs,
		});
	}

	public async flushQueue() {
		if (this._isQueueFlushing || (this._inQueue.length === 0 && this._outQueue.length === 0)) return;

		this._isQueueFlushing = true;

		// kill the timeout because we're flushing the queue
		if (this._inQueueTimeout) {
			clearTimeout(this._inQueueTimeout);
			this._inQueueTimeout = undefined as unknown as ReturnType<typeof setTimeout>;
		}

		let postErrored = false;

		// no async calls in the next three lines, so nothing can add to inQueue between push and reset
		this._outQueue.push(...this._inQueue);
		this._inQueue = [];
		this._inQueueSize = 0;

		while (this._outQueue.length > 0) {
			// slice -> don't remove from queue without successful POST; if end > length, slice() returns up to length
			const body = this._outQueue.slice(0, this._maxPostItems).join('');

			// POST logs
			try {
				await this._postToSplunk({
					url: this._url,
					headers: this._headers,
					body,
					maxPostRetries: this._maxPostRetries,
					postTimeoutMs: this._postTimeoutMs,
				});

				// splice -> POST succeeded, remove elements from queue; if end > length, splice() removes up to length
				// _maxPostItems is safe because _isQueueFlushing ensures we don't add anything to outQueue while POSTing
				this._outQueue.splice(0, this._maxPostItems);

				// reset error count after all POSTed
				if (this._outQueue.length === 0) {
					this._postErrorCount = 0;
				} else {
					await delay(this._postTimeoutMs);
				}
			} catch (e) {
				postErrored = true;
				const { message, ...error } = e as Error;
				const errorData = {
					...error,
					msg: message,
					postErrorCount: this._postErrorCount,
					outQueueLength: this._outQueue.length,
					inQueueLength: this._inQueue.length,
				};
				this._stdout.write(`ERROR: SplunkLogger | ${message} | ${JSON.stringify(errorData)}\n`);

				// add a log entry for the error, but limit error logs to avoid spamming Splunk
				// may accept more inQueue logs between calls, so can't assume last entry is a POST error
				if (this._postErrorCount < this._maxPostErrorsToSplunk) {
					this._postErrorCount++;
					const { event } = this._formatLog({
						...errorData,
						time: new Date(),
						name: 'SplunkLogger',
						host: os.hostname(),
					});
					event.event.severity = 'error';
					this._outQueue.push(JSON.stringify(event));
				}
			}

			if (postErrored) break;
		}

		if (this._inQueue.length > 0 || this._outQueue.length > 0) this._resetTimeoutIfNotRunning();
		this._isQueueFlushing = false;
	}

	public addEvent(ev: any) {
		const { logLevel, event } = this._formatLog(ev);

		if (logLevel < this._logLevel) return; // don't log events that don't meet the level threshold

		const stringEvent = JSON.stringify(event);
		this._inQueue.push(stringEvent);
		this._inQueueSize += stringEvent.length;

		if (
			(this._maxBatchBytes > 0 ? this._inQueueSize >= this._maxBatchBytes : false) ||
			(this._maxBatchItems > 0 ? this._inQueue.length >= this._maxBatchItems : false)
		) {
			this.flushQueue();
		} else {
			this._resetTimeoutIfNotRunning();
		}
	}

	public getInQueue() {
		return [...this._inQueue];
	}

	public getOutQueue() {
		return [...this._outQueue];
	}
}
