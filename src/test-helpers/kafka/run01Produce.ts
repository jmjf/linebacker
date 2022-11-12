import { Kafka } from 'kafkajs';
import { delay } from '../../common/utils/utils';

const kafka = new Kafka({
	clientId: 'my-app',
	brokers: ['localhost:19093', 'localhost:29093', 'localhost:39093'],
});

const produce = async (producerId: number, delayMs: number) => {
	const producer = kafka.producer();
	console.log(`>>>>>>>>>> CONNECT PRODUCER ${producerId} <<<<<<<<<<<<`);
	// Producing
	await producer.connect();

	for (let i = 0; i < 5; i++) {
		console.log('>>>>>>>>>> SEND MESSAGE <<<<<<<<<<<<');
		await producer.send({
			topic: 'test-topic',
			messages: [
				{
					key: i.toString(),
					value: `Message ${i} -- ${new Date().toISOString()}`,
				},
			],
		});
		await delay(delayMs);
	}
};

const run = async () => {
	produce(1, 3000);
};

run().catch(console.error);
