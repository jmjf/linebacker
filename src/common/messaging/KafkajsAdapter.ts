import got from 'got/dist/source';
import { ConnectEvent, Kafka, KafkaConfig, logLevel, Producer } from 'kafkajs';
import path from 'path';
import * as AdapterErrors from '../adapter/AdapterErrors';
import { err, ok, Result } from '../core/Result';
import { IBusMessage } from './MessageBus';
import { logger } from '../../infrastructure/logging/pinoLogger';
import { IMessageBusAdapter } from './IMessageBusAdapter';

const moduleName = path.basename(module.filename);

export class KafkajsAdapter implements IMessageBusAdapter {
	private _kafka: Kafka;
	private _producer: Producer;
	private _producerIsConnected: boolean;

	constructor(config: KafkaConfig) {
		const functionName = 'constructor';
		this._kafka = new Kafka({
			clientId: config.clientId,
			brokers: config.brokers,
			connectionTimeout: config.connectionTimeout || 3000,
			requestTimeout: config.requestTimeout || 20000,
			retry: { ...config.retry, retries: 100 },
			logLevel: config.logLevel || logLevel.NOTHING,
		});
		this._producer = this._kafka.producer();
		this._producerIsConnected = false;
		this._producer.on('producer.connect', (ev: ConnectEvent) => (this._producerIsConnected = true));
		this._producer.on('producer.disconnect', (ev: ConnectEvent) => (this._producerIsConnected = false));
		this._connectProducer(functionName);
	}

	private async _connectProducer(calledFrom: string) {
		const functionName = '_connectProducer';

		try {
			await this._producer.connect();
			return true;
		} catch (e) {
			logger.error({ moduleName, functionName, calledFrom, error: e }, 'Error connecting producer');
			return false;
		}
	}

	public async publish(message: IBusMessage): Promise<Result<IBusMessage, Error>> {
		const functionName = 'publish';

		if (!this._producerIsConnected && !(await this._connectProducer(functionName))) {
			// TODO: need an error for this
			return err(new Error('connect error'));
		}

		try {
			await this._producer.send({
				topic: message.topicName,
				messages: [
					{
						key: message.messageKey,
						value: message.messageDataString,
					},
				],
			});
			logger.trace(
				{ moduleName, functionName, topic: message.topicName, messageKey: message.messageKey },
				'Published message'
			);
			return ok(message);
		} catch (e) {
			logger.error(
				{ moduleName, functionName, error: e, topic: message.topicName, key: message.messageKey },
				'Publish error'
			);
			// TODO: need an error for this, possibly several
			return err(e as Error);
		}
	}
}
