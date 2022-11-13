import { Kafka } from 'kafkajs';
import { ConsoleMessageHandler } from './ConsoleMessageHandler';

const TOPIC_NAME = 'backup-request-accepted';

const kafka = new Kafka({
	clientId: 'console-consumer',
	brokers: ['localhost:19093'],
});

const consume = async () => {
	const consumer = kafka.consumer({ groupId: 'test-1-group' });
	const messageHandler = new ConsoleMessageHandler();

	await consumer.connect();
	await consumer.subscribe({ topic: TOPIC_NAME, fromBeginning: true });
	await consumer.run({
		eachMessage: async ({ partition, message }) => {
			const result = await messageHandler.onMessage(message);
			console.log(`RESULT: ${result}`);
		},
	});
};

const run = async () => {
	const admin = kafka.admin();
	await admin.connect();
	// console.log('>>>>>>>>>> DELETE OLD TOPIC <<<<<<<<<<<<');
	// await admin.deleteTopics({
	// 	topics: ['test-topic'],
	// });

	await admin.createTopics({
		waitForLeaders: true,
		topics: [{ topic: TOPIC_NAME, numPartitions: 3 }],
	});

	consume();
};

run().catch(console.error);
