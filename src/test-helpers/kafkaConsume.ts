import { Kafka } from 'kafkajs';
import { delay } from '../common/utils/utils';

const kafka = new Kafka({
	clientId: 'my-app',
	brokers: ['localhost:19093'],
});

const consume = async (consumerId: number) => {
	const consumer = kafka.consumer({ groupId: 'test-group' });
	// Consuming
	console.log(`>>>>>>>>>> CONNECT CONSUMER ${consumerId} <<<<<<<<<<<<`);
	await consumer.connect();
	console.log(`>>>>>>>>>> SUBSCRIBE CONSUMER ${consumerId} <<<<<<<<<<<<`);
	await consumer.subscribe({ topic: 'test-topic', fromBeginning: true });
	console.log(`>>>>>>>>>> RUN CONSUMER ${consumerId} <<<<<<<<<<<<`);
	await consumer.run({
		eachMessage: async ({ topic, partition, message }) => {
			console.log(`consumer: ${consumerId} partition ${partition}, offset ${message.offset}`);
			console.log((message.value as unknown as string).toString());
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

	for (let i = 0; i < 3; i++) {
		consume(i);
	}
};

run().catch(console.error);
