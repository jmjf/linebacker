import abstractTransport from 'pino-abstract-transport';
import pump from 'pump';
import { Logger as SplunkLogger, Config as SplunkConfig, SendContext } from 'splunk-logging';
import { Transform } from 'stream';

export interface SplunkLoggerOptions {
	token: string;
	url: string;
	// following options cause logs to trigger based on whichever is met first
	batchInterval: number; // max milliseconds to wait before sending to Splunk
	maxBatchCount: number; // max number of logs to accumulate before sending to Splunk
	maxBatchSize: number; // max size in bytes to accumulate before sending to Splunk
}

export interface PinoSplunkTransportOptions {
	transportOptions?: string;
	splunkOptions?: SplunkConfig;
	splunkSourceType?: string;
}

// splunk config options
// * @param {string} config.token - HTTP Event Collector token, required.
// * @param {string} [config.name=splunk-javascript-logging/0.11.1] - Name for this logger.
// * @param {string} [config.host=localhost] - Hostname or IP address of Splunk Enterprise or Splunk Cloud server.
// * @param {string} [config.maxRetries=0] - How many times to retry when HTTP POST to Splunk Enterprise or Splunk Cloud fails.
// * @param {string} [config.path=/services/collector/event/1.0] - URL path to send data to on the Splunk Enterprise or Splunk Cloud server.
// * @param {string} [config.protocol=https] - Protocol used to communicate with the Splunk Enterprise or Splunk Cloud server, <code>http</code> or <code>https</code>.
// * @param {number} [config.port=8088] - HTTP Event Collector port on the Splunk Enterprise or Splunk Cloud server.
// * @param {string} [config.url] - URL string to pass to {@link https://nodejs.org/api/url.html#url_url_parsing|url.parse}. This will try to set
// * <code>host</code>, <code>path</code>, <code>protocol</code>, <code>port</code>, <code>url</code>. Any of these values will be overwritten if
// * the corresponding property is set on <code>config</code>.
// * @param {string} [config.level=info] - Logging level to use, will show up as the <code>severity</code> field of an event, see
// *  [SplunkLogger.levels]{@link SplunkLogger#levels} for common levels.
// * @param {number} [config.batchInterval=0] - Automatically flush events after this many milliseconds.
// * When set to a non-positive value, events will be sent one by one. This setting is ignored when non-positive.
// * @param {number} [config.maxBatchSize=0] - Automatically flush events after the size of queued
// * events exceeds this many bytes. This setting is ignored when non-positive.
// * @param {number} [config.maxBatchCount=1] - Automatically flush events after this many
// * events have been queued. Defaults to flush immediately on sending an event. This setting is ignored when non-positive.

// token: string;
// url?: string | undefined;
// batchInterval?: number | undefined;
// maxBatchSize?: number | undefined;
// maxBatchCount?: number | undefined;
// maxRetries?: number | undefined;
// name?: string | undefined;
// host?: string | undefined;
// path?: string | undefined;
// protocol?: 'http' | 'https' | undefined;
// port?: number | undefined;
// level?: string | undefined;

export function logToSplunkFactory(opts: PinoSplunkTransportOptions) {
	const splunkOptions = {
		token:
			typeof opts.splunkOptions?.token === 'string'
				? opts.splunkOptions.token
				: '3d295975-5fa2-4844-ac0a-dc41a130ab2e',
		url: typeof opts.splunkOptions?.url === 'string' ? opts.splunkOptions.url : 'https://localhost:8068',
		batchInterval: typeof opts.splunkOptions?.batchInterval === 'number' ? opts.splunkOptions.batchInterval : 2000,
		maxBatchCount: typeof opts.splunkOptions?.maxBatchCount === 'number' ? opts.splunkOptions.maxBatchCount : 5,
		maxBatchSize: typeof opts.splunkOptions?.maxBatchSize === 'number' ? opts.splunkOptions.maxBatchSize : 2048,
		maxRetries: typeof opts.splunkOptions?.maxRetries === 'number' ? opts.splunkOptions.maxRetries : 5,
		name: opts.splunkOptions?.name || 'pino-splunk-transport',
		host: opts.splunkOptions?.host,
		path: opts.splunkOptions?.path,
		protocol: opts.splunkOptions?.protocol || 'http',
		port: opts.splunkOptions?.port,
		level: opts.splunkOptions?.level,
	};
	const splunkSourceType = typeof opts.splunkOptions?.url === 'string' ? opts.splunkOptions.url : '_json';

	const splunkLogger = new SplunkLogger(splunkOptions);
	splunkLogger.error = (err: Error, context: SendContext) => {
		console.log('ERROR Logging to Splunk', err, context);
	};

	console.log('pinoSplunkTransport | initalized', splunkOptions);

	function logToSplunk(obj: any) {
		const logPayload = {
			message: obj,
			metadata: {
				source: obj.name || 'unknown',
				sourcetype: splunkSourceType,
				host: obj.host || 'unknown',
				time: new Date(obj.time).valueOf() / 1000,
			},
			severity: obj.levelName,
		};
		splunkLogger.send(logPayload);
	}

	return logToSplunk;
}

export function build(opts: PinoSplunkTransportOptions) {
	const logToSplunk = logToSplunkFactory(opts);
	return abstractTransport(
		function (source) {
			console.log('pinoSplunkTransport | abstractTransport()');
			const stream = new Transform({
				autoDestroy: true, // pino-pretty says this is required
				objectMode: true, // get data in object chunks, not byte chunks
				transform(obj, enc, cb) {
					console.log('pst | transform', obj);
					logToSplunk(obj);
					cb(null, obj);
				},
			});

			source.on('unknown', (err) => {
				console.log('pst unknown', err);
			});

			pump(source, stream, () => {
				console.log('pump error');
			});
			return stream;
			// for await (const obj of source) {
			// 	console.log('pinoSplunkTransport received', typeof obj, obj);

			// 	const logPayload = {
			// 		message: obj,
			// 		metadata: {
			// 			source: obj.name,
			// 			sourcetype: splunkSourceType,
			// 			host: obj.host,
			// 			time: new Date(obj.time).valueOf() / 1000,
			// 		},
			// 		severity: obj.levelName,
			// 	};
			// 	splunkLogger.send(logPayload);
			// }
		},
		{ parse: 'lines', enablePipelining: true }
	);
}

export default build;
