import pump from 'pump';
import buildTransport from './pinoSplunkTransport';

// my default opts are good for now
const opts = {
	splunkOptions: {
		token: '3d295975-5fa2-4844-ac0a-dc41a130ab2e',
		url: 'http://localhost:8068',
		batchInterval: 2000,
		maxBatchCount: 5,
		maxBatchSize: 2048,
		maxRetries: 5,
		protocol: 'http' as 'http' | 'https' | undefined,
	},
};
const pst = buildTransport(opts);
pump(process.stdin, pst);
