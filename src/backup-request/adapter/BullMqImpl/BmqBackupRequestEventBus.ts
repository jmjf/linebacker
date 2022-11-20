import { Result, ok, err } from '../../../common/core/Result';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';

import { IEventBusEvent } from '../../../infrastructure/event-bus/IEventBus';
import { BullMq } from '../../../infrastructure/bullmq/bullMqInfra';

import { BackupRequest } from '../../domain/BackupRequest';
import { IEventBus } from '../IEventBus';

import { ConnectionOptions } from 'bullmq';
import path from 'node:path';

const moduleName = path.basename(module.filename);
export class BmqBackupRequestEventBus implements IEventBus {
	private bullMq: BullMq;
	private connection: ConnectionOptions;

	constructor(bullMq: BullMq, connection: ConnectionOptions) {
		this.bullMq = bullMq;
		this.connection = connection;
	}

	// exists(requestId: string): Promise<Result<boolean, AdapterErrors.EventBusError>>;
	public async publish(event: IEventBusEvent): Promise<Result<IEventBusEvent, AdapterErrors.EventBusError>> {
		const functionName = 'publish';

		try {
			const queue = new this.bullMq.Queue(event.topicName, { connection: this.connection });
			const res = await queue.add(event.eventKey, event.eventData, {
				attempts: 2,
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
				new AdapterErrors.EventBusError('event bus publish error', {
					error,
					event,
					moduleName,
					functionName,
				})
			);
		}
	}

	private mapToQueue(backupRequest: BackupRequest) {
		const { backupRequestId, backupJobId } = backupRequest;
		return {
			backupRequestId: backupRequestId.value,
			backupJobId: backupJobId.value,
			dataDate: backupRequest.dataDate,
			preparedDataPathName: backupRequest.preparedDataPathName,
			getOnStartFlag: backupRequest.getOnStartFlag,
			transportTypeCode: backupRequest.transportTypeCode,
			statusTypeCode: backupRequest.statusTypeCode,
			receivedTimestamp: backupRequest.receivedTimestamp,
			requesterId: backupRequest.requesterId,
		};
	}
}
