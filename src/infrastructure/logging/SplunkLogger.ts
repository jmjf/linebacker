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
	formatLog?: (event: object, logLevelKey?: string) => { logLevel: number | string; event: object };
	// event is really a superset of { time: number, source: string, host: string, severity: string }
	// but ts4.8 can't express that
}

interface HttpPostOptions {
	url: string;
	headers: Record<string, any>;
	body: string;
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
	private _maxPostRetries: number;
	private _postTimeoutMs: number;
	private _maxPostItems: number;
	private _headers: Record<string, any> = {};

	private _queueSize = 0;
	private _queue: string[] = [];
	private _queueInterval: ReturnType<typeof this._resetInterval>;

	private _stdout: SonicBoom;

	private _httpErrorCount = 0;
	private _queueFlushing = false;
	private MAX_HTTP_ERROR_COUNT = 5;

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
		// if any one is configured, default to a value that will be ignored (-1), else default to a safe default
		this._maxBatchBytes =
			opts.maxBatchBytes || opts.maxBatchItems || opts.maxBatchWaitMs ? opts.maxBatchBytes || -1 : 0;
		this._maxBatchItems =
			opts.maxBatchBytes || opts.maxBatchItems || opts.maxBatchWaitMs ? opts.maxBatchItems || -1 : 1;
		this._maxBatchWaitMs =
			opts.maxBatchBytes || opts.maxBatchItems || opts.maxBatchWaitMs ? opts.maxBatchWaitMs || -1 : 0;

		this._maxPostRetries = opts.maxPostRetries || 5;
		// either the configured value or an alternate configuration value or a default
		this._postTimeoutMs = opts.postTimeoutMs || this._maxBatchWaitMs > 0 ? this._maxBatchWaitMs : 2000;
		this._maxPostItems = opts.maxPostItems || this._maxBatchItems > 1 ? this._maxBatchItems : 200;

		this._headers['Content-Type'] = 'application/x-www-form-urlencoded';
		this._headers['Authorization'] = `Splunk ${this._splunkToken}`;
	}

	private _resetInterval() {
		return setInterval(() => {
			if (this._queue.length > 0) this.flushQueue();
		}, this._maxBatchWaitMs);
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
	private async _postToSplunk({ url, headers, body }: HttpPostOptions) {
		return got(url, {
			method: 'POST',
			headers,
			body,
			retry: { methods: ['POST'], limit: this._maxPostRetries },
			timeout: this._postTimeoutMs,
		});
	}

	public async flushQueue() {
		if (this._queueFlushing) return;

		this._queueFlushing = true;
		let postErrored = false;

		// kill the timer because we're flushing the queue
		if (this._queueInterval) {
			clearInterval(this._queueInterval);
			this._queueInterval = undefined as unknown as ReturnType<typeof this._resetInterval>;
		}

		while (this._queue.length > 0) {
			// don't remove from this._queue without successful POST; if end > length, slice() returns up to length
			const body = this._queue.slice(0, this._maxPostItems).join('');

			// POST logs
			try {
				await this._postToSplunk({
					url: this._url,
					headers: this._headers,
					body,
				});

				// on successful POST, remove elements from this._queue; if end > length, splice() removes up to length
				this._queue.splice(0, this._maxPostItems);

				// reset error count after all POSTed; check here to avoid unneeded delay; queue won't be empty on catch
				if (this._queue.length === 0) this._httpErrorCount = 0;
				if (this._httpErrorCount > 0) await delay(this._postTimeoutMs);
			} catch (e) {
				postErrored = true;
				const { message, ...error } = e as Error;
				this._stdout.write(`ERROR: SplunkLogger | ${message} | ${JSON.stringify(error)}\n`);

				// add a log entry for the error, but don't log more than max to avoid spamming Splunk
				if (this._httpErrorCount < this.MAX_HTTP_ERROR_COUNT) {
					const { event } = this._formatLog({
						...error,
						time: new Date(),
						name: 'SplunkLogger',
						host: os.hostname(),
					});
					event.event.severity = 'error';
					this._queue.push(JSON.stringify(event));
					this._httpErrorCount++;
				}
				// restart the send interval so we'll retry soon
				if (!this._queueInterval) this._queueInterval = this._resetInterval();
			}

			if (postErrored) break;
		}

		// always reset queueSize -- if POST error, avoids immediate retry
		this._queueSize = 0;
		this._queueFlushing = false;
	}

	public addEvent(ev: any) {
		const { logLevel, event } = this._formatLog(ev);

		if (logLevel < this._logLevel) return; // don't log events that don't meet the level threshold

		const stringEvent = JSON.stringify(event);
		this._queue.push(stringEvent);
		this._queueSize += stringEvent.length;

		// TODO: separate add event queue from flushing queue to avoid immediate resend after POST error
		if (
			(this._maxBatchBytes > 0 ? this._queueSize >= this._maxBatchBytes : false) ||
			(this._maxBatchItems > 0 ? this._queue.length >= this._maxBatchItems : false)
		) {
			this.flushQueue();
		} else {
			if (!this._queueInterval) this._queueInterval = this._resetInterval();
		}
	}

	public getQueue() {
		return [...this._queue];
	}
}
