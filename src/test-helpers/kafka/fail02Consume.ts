import { Kafka } from 'kafkajs';
import { resolve } from 'path';
import { delay } from '../../common/utils/utils';

const kafka = new Kafka({
	clientId: 'my-app',
	brokers: ['localhost:19093'],
});

const consume = async (consumerId: number, isRunAwaited: boolean, delayMs: number) => {
	const runType = isRunAwaited ? 'run awaited' : 'run not awaited';

	const consumer = kafka.consumer({ groupId: 'test-group' });
	// Consuming
	await consumer.connect();
	await consumer.subscribe({ topic: 'test-topic2', fromBeginning: true });
	await consumer.run({
		autoCommit: false,
		eachMessage: async ({ topic, partition, message }) => {
			const value = JSON.parse((message.value as unknown as string).toString());
			const action = value.key === 2 ? 'reject' : 'consume';
			console.log(`${action} ${runType} ${message.offset} ${(message.value as unknown as string).toString()}`);
			await delay(delayMs);
			if (action === 'consume') {
				consumer.commitOffsets([{ topic, partition, offset: message.offset }]);
			}
		},
	});
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

	consume(1, true, 1500);
};

run().catch(console.error);
