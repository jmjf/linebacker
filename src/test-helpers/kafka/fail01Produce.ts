import { Kafka } from 'kafkajs';
import { delay } from '../../common/utils/utils';

const kafka = new Kafka({
	clientId: 'my-app',
	brokers: ['localhost:19093', 'localhost:29093', 'localhost:39093'],
});

const produce = async (producerId: number, delayMs: number) => {
	const producer = kafka.producer();
	console.log(`>>>>>>>>>> CONNECT PRODUCER ${producerId} <<<<<<<<<<<<`);
	await producer.connect();

	for (let i = 0; i < 5; i++) {
		console.log(`>>>>>>>>>> SEND MESSAGE ${i} <<<<<<<<<<<<`);
		await producer.send({
			topic: 'test-topic2',
			messages: [
				{
					key: i.toString(),
					value: JSON.stringify({ key: i, data: `Message ${i} -- ${new Date().toISOString()}` }),
				},
			],
		});
		await delay(delayMs);
	}
};

const run = async () => {
	produce(1, 1000);
};

run().catch(console.error);
