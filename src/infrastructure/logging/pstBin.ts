import pump from 'pump';
import buildTransport from './pinoSplunkTransport';
import dotenv from 'dotenv';

if (!process.env.APP_ENV) throw new Error('pino Splunk transport bin: APP_ENV is undefined');
dotenv.config({ path: `./env/${process.env.APP_ENV}.env` });
if (!process.env.SPLUNK_HEC_TOKEN) throw new Error('pino Splunk transport bin: SPLUNK_HEC_TOKEN is undefined');

// my default opts are good for now
const opts = {
	splunkOptions: {
		// This token is for a local Splunk running in Docker
		splunkToken: process.env.SPLUNK_HEC_TOKEN,
		url: `http://${process.env.SPLUNK_HOST}:${process.env.SPLUNK_HEC_PORT}/services/collector/event/1.0`,
		logLevel: 20, // 40 = warning, 30 = info, 20 = debug
		levelMap: new Map([
			[60, 'fatal'],
			[50, 'error'],
			[40, 'warning'],
			[30, 'info'],
			[20, 'debug'],
			[10, 'trace'],
		]),
		maxBatchWaitMs: 5000,
		maxBatchItems: 5,
		maxBatchBytes: 2048,
		maxPostRetries: 5,
	},
};
const pst = buildTransport(opts);
pump(process.stdin, pst);