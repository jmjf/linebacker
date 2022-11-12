import { Kafka } from 'kafkajs';
import { delay } from '../../common/utils/utils';

const kafka = new Kafka({
	clientId: 'my-app',
	brokers: ['localhost:19093'],
});

const consume = async (consumerId: number, isRunAwaited: boolean, delayMs: number) => {
	const runType = isRunAwaited ? 'run awaited' : 'run not awaited';

	const consumer = kafka.consumer({ groupId: 'test-group' });
	// Consuming
	const connectResult = await consumer.connect();
	console.log(`>>>> CONNECT RESULT <<<<<`);
	console.log(connectResult);
	const subscribeResult = await consumer.subscribe({ topic: 'test-topic2', fromBeginning: true });
	console.log(`>>>> SUBSCRIBE RESULT <<<<<`);
	console.log(subscribeResult);
	const runResult = await consumer.run({
		eachMessage: async ({ topic, partition, message }) => {
			console.log(`consume ${runType} ${partition} ${(message.value as unknown as string).toString()}`);
			await delay(delayMs);
		},
	});
	console.log(`>>>> RUN RESULT <<<<<`);
	console.log(runResult);
};

const run = async () => {
	const admin = kafka.admin();
	console.log('>>>>>>>>>> CONNECT ADMIN <<<<<<<<<<<<');
	await admin.connect();
	// console.log('>>>>>>>>>> DELETE OLD TOPIC <<<<<<<<<<<<');
	// await admin.deleteTopics({
	// 	topics: ['test-topic'],
	// });

	console.log('>>>>>>>>>> CREATE TOPIC <<<<<<<<<<<<');
	await admin.createTopics({
		waitForLeaders: true,
		topics: [{ topic: 'test-topic', numPartitions: 3 }],
	});

	consume(1, true, 1000);
};

run().catch(console.error);
