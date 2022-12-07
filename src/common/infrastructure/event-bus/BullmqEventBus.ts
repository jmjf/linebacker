import path from 'node:path';
import * as bullMq from 'bullmq';
import { ConnectionOptions, KeepJobs } from 'bullmq';

import { appState } from '../../../infrastructure/app-state/appState';

import { Result, ok, err } from '../../core/Result';
import * as InfrastructureErrors from '../InfrastructureErrors';

import { EventBusEvent, IEventBus } from './IEventBus';

const moduleName = path.basename(module.filename);
type BullMq = typeof bullMq;

export class BullmqEventBus implements IEventBus {
	private bullMq: BullMq;
	private connection: ConnectionOptions;
	private removeOnComplete: boolean | number | KeepJobs | undefined;
	private removeOnFail: boolean | number | KeepJobs | undefined;

	constructor(bullMq: BullMq, connection: ConnectionOptions) {
		this.bullMq = bullMq;
		this.connection = connection;
		this.removeOnComplete = appState.eventBus_bmqRemoveOnComplete;
		this.removeOnFail = appState.eventBus_bmqRemoveOnFail;
	}

	// exists(requestId: string): Promise<Result<boolean, InfrastructureErrors.EventBusError>>;
	public async publishEvent(
		event: EventBusEvent<unknown>
	): Promise<Result<EventBusEvent<unknown>, InfrastructureErrors.EventBusError>> {
		const functionName = 'publish';

		try {
			const queue = new this.bullMq.Queue(event.topicName, { connection: this.connection });
			const res = await queue.add(event.eventKey, event.eventData, {
				attempts: Number.MAX_SAFE_INTEGER - 1,
				jobId: `${event.eventData.eventType}|${event.eventKey}`,
				backoff: {
					type: 'custom',
				},
				removeOnComplete: this.removeOnComplete,
				removeOnFail: this.removeOnFail,
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
		events: EventBusEvent<unknown>[]
	): Promise<Result<EventBusEvent<unknown>[], InfrastructureErrors.EventBusError>> {
		for (const ev of events) {
			const eventResult = await this.publishEvent(ev);
			if (eventResult.isErr()) {
				return err(eventResult.error);
			}
		}
		// publishEvent returns the event we passed it if ok, so if nothing failed, can just return the events passed
		return ok(events);
	}

	public subscribe(eventName: string, handler: (event: EventBusEvent<unknown>) => void): void {
		return;
	}

	public clearHandlers() {
		return;
	}
}
