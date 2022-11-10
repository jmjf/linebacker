import { delay, Queue, Worker } from 'bullmq';
import { bullMqConnection } from '../infrastructure/bullmq/bullMqInfra';

async function runTest() {
	// Create a new connection in every instance
	const myQueue = new Queue('myqueue', { connection: bullMqConnection });

	const myWorker = new Worker(
		'myqueue',
		async (job) => {
			console.log('job', job.name, 'data', job.data);
		},
		{ connection: bullMqConnection }
	);

	myWorker.on('completed', (job) => {
		console.log(`${job.id} has completed!`);
	});

	myWorker.on('failed', (job, err) => {
		console.log(`${job.id} has failed with ${err.message}`);
	});

	const testData = [1, 2, 'hi', 4];

	console.log('enqueue');

	for (const data of testData) {
		await myQueue.add(`job-${data}`, { info: `This is job ${data}.` });
		await delay(10);
	}

	console.log('enqueue done');
}

async function readTest() {
	const worker = new Worker(
		'test',
		async (job) => {
			console.log('job', job.name, 'data', job.data);
		},
		{ connection: bullMqConnection }
	);

	await delay(5000);
	process.exit(0);
}

readTest();
