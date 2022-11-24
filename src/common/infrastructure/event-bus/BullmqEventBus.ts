import { Result, ok, err } from '../../core/Result';
import * as InfrastructureErrors from '../InfrastructureErrors';

import { IEventBusEvent } from './IEventBus';
import { bullMq, BullMq, bullMqConnection } from '../../../infrastructure/bullmq/bullMqInfra';

import { IEventBus } from './IEventBus';

import { ConnectionOptions } from 'bullmq';
import path from 'node:path';

const moduleName = path.basename(module.filename);

export class BullmqEventBus implements IEventBus {
	private bullMq: BullMq;
	private connection: ConnectionOptions;

	constructor(bullMq: BullMq, connection: ConnectionOptions) {
		this.bullMq = bullMq;
		this.connection = connection;
	}

	// exists(requestId: string): Promise<Result<boolean, InfrastructureErrors.EventBusError>>;
	public async publishEvent(
		event: IEventBusEvent
	): Promise<Result<IEventBusEvent, InfrastructureErrors.EventBusError>> {
		const functionName = 'publish';

		try {
			const queue = new this.bullMq.Queue(event.topicName, { connection: this.connection });
			const res = await queue.add(event.eventKey, event.eventData, {
				attempts: 2,
				jobId: `${event.eventData.eventType}|${event.eventKey}`,
				backoff: {
					type: 'exponential',
					delay: 1000,
				},
				removeOnComplete: 20,
				removeOnFail: 20,
			});

			return ok(event);
		} catch (e) {
			const error = e as Error;
			return err(
				new InfrastructureErrors.EventBusError('event bus publish error', {
					error,
					event,
					moduleName,
					functionName,
				})
			);
		}
	}

	public async publishEventsBulk(
		events: IEventBusEvent[]
	): Promise<Result<IEventBusEvent[], InfrastructureErrors.EventBusError>> {
		for (const ev of events) {
			const eventResult = await this.publishEvent(ev);
			if (eventResult.isErr()) {
				return eventResult;
			}
		};
		// publishEvent returns the event we passed it if ok, so if nothing failed, can just return the events passed
		return ok(events);
	}

	public async subscribe(eventName: string, handler: (event: IEventBusEvent) => void): Promise<void> {
		return;
	}
}

export const bullmqBus = new BullmqEventBus(bullMq, bullMqConnection);
