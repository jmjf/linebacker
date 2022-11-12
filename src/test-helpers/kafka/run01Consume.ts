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
	console.log(`>>>>>>>>>> CONNECT CONSUMER ${consumerId} <<<<<<<<<<<<`);
	await consumer.connect();
	console.log(`>>>>>>>>>> SUBSCRIBE CONSUMER ${consumerId} <<<<<<<<<<<<`);
	await consumer.subscribe({ topic: 'test-topic', fromBeginning: true });
	console.log(`>>>>>>>>>> RUN CONSUMER ${consumerId} ${runType} <<<<<<<<<<<<`);
	if (isRunAwaited) {
		await consumer.run({
			eachMessage: async ({ topic, partition, message }) => {
				console.log(`consume ${runType} ${partition} ${(message.value as unknown as string).toString()}`);
				await delay(delayMs);
			},
		});
		console.log(`>>>>>>>>>> AFTER RUN ${consumerId} ${runType} <<<<<<<<<<<<`);
	} else {
		consumer.run({
			eachMessage: async ({ topic, partition, message }) => {
				console.log(`consume ${runType} ${partition} ${(message.value as unknown as string).toString()}`);
				await delay(delayMs);
			},
		});
		console.log(`>>>>>>>>>> AFTER RUN ${consumerId} ${runType} <<<<<<<<<<<<`);
	}
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
	consume(2, false, 1000);
};

run().catch(console.error);
