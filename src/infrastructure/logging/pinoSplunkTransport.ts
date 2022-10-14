import { once } from 'events';
import build from 'pino-abstract-transport';
import SonicBoom from 'sonic-boom';
import { SplunkLogger, SplunkLoggerOptions } from './SplunkLogger';

export interface PinoSplunkTransportOptions {
	splunkOptions: SplunkLoggerOptions;
}

export default function buildTransport(opts: PinoSplunkTransportOptions) {
	const stdout = new SonicBoom({ dest: 1, sync: false });
	//stdout.write(`buildTransport ${JSON.stringify(opts)}`);

	const splunkLogger = new SplunkLogger(stdout, opts.splunkOptions);

	return build(
		async function (source) {
			for await (const obj of source) {
				splunkLogger.addEvent(obj);
				const toDrain = !stdout.write(`${JSON.stringify(obj)}\n`);
				if (toDrain) {
					await once(stdout, 'drain');
				}
			}
		},
		{
			async close(err) {
				stdout.write(`pino-splunk-transport CLOSE: ${JSON.stringify(err)}\n ${err}`);
				stdout.end();
				await once(stdout, 'close');
			},
		}
	);
}
