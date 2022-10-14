import got from 'got/dist/source';
import SonicBoom from 'sonic-boom';
import os from 'node:os';

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
	maxRetries?: number;
	httpTimeoutMs?: number;
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
	private _maxRetries: number;
	private _httpTimeoutMs: number;
	private _headers: Record<string, any> = {};

	private _queueSize = 0;
	private _queue: string[] = [];
	private _queueInterval: ReturnType<typeof this._resetInterval>;

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

		this._maxBatchBytes = opts.maxBatchBytes || 0;
		this._maxBatchItems = opts.maxBatchItems || 1;
		this._maxBatchWaitMs = opts.maxBatchWaitMs || 0;

		this._maxRetries = opts.maxRetries || 5;
		this._httpTimeoutMs = opts.httpTimeoutMs || Math.min(2000, this._maxBatchWaitMs - 100);

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
	private async _postEvent({ url, headers, body }: HttpPostOptions) {
		return got(url, {
			method: 'POST',
			headers,
			body,
			retry: { methods: ['POST'], limit: this._maxRetries },
			timeout: this._httpTimeoutMs,
		});
	}

	public async flushQueue() {
		// kill the timer because we're flushing the queue
		if (this._queueInterval) {
			clearInterval(this._queueInterval);
			this._queueInterval = undefined as unknown as ReturnType<typeof this._resetInterval>;
		}

		const body = this._queue.join('');
		// set up request
		try {
			await this._postEvent({
				url: this._url,
				headers: this._headers,
				body,
			});
			this._queue = [];
		} catch (e) {
			const { message, ...error } = e as Error;
			this._stdout.write(`ERROR: SplunkLogger ${message}/n ${JSON.stringify(error)}`);

			// add a log entry for the error
			const { event } = this._formatLog({
				...error,
				time: new Date(),
				name: 'SplunkLogger',
				host: os.hostname(),
			});
			event.event.severity = 'error';
			this._queue.push(JSON.stringify(event));

			// restart the delay, stopped it earlier so don't need to check
			this._queueInterval = this._resetInterval();
		}

		// always reset queueSize -- if an error, avoids immediate retry
		this._queueSize = 0;
	}

	public addEvent(ev: any) {
		const { logLevel, event } = this._formatLog(ev);

		if (logLevel < this._logLevel) return; // don't log events that don't meet the level threshold

		const stringEvent = JSON.stringify(event);
		this._queue.push(stringEvent);
		this._queueSize += stringEvent.length;

		if (this._queueSize >= this._maxBatchBytes || this._queue.length >= this._maxBatchItems) {
			this.flushQueue();
		} else {
			if (!this._queueInterval) this._queueInterval = this._resetInterval();
		}
	}

	public getQueue() {
		return [...this._queue];
	}
}
