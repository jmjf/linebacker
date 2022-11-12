import { Kafka } from 'kafkajs';
import { delay } from '../common/utils/utils';

const kafka = new Kafka({
	clientId: 'my-app',
	brokers: ['localhost:19093', 'localhost:29093', 'localhost:39093'],
});

const produce = async (producerId: number) => {
	const producer = kafka.producer();
	console.log(`>>>>>>>>>> CONNECT PRODUCER ${producerId} <<<<<<<<<<<<`);
	// Producing
	await producer.connect();

	for (let i = 0; i < 30; i++) {
		console.log('>>>>>>>>>> SEND MESSAGE <<<<<<<<<<<<');
		await producer.send({
			topic: 'test-topic',
			messages: [
				{
					key: i.toString(),
					value: `Hello KafkaJS user ${i} from producer ${producerId}! ${new Date().toISOString()}`,
				},
			],
		});
		await delay(100);
	}
};

const run = async () => {
	for (let i = 0; i < 10; i++) {
		produce(i);
		await delay(100);
	}
};

run().catch(console.error);
