import { Result, ok, err } from '../../../common/core/Result';
import { BackupRequest } from '../../domain/BackupRequest';
import { IBackupRequestEventBus } from '../IBackupRequestEventBus';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';

import { ConnectionOptions } from 'bullmq';
import { BullMq } from '../../../infrastructure/bullmq/bullMqInfra';
import path from 'node:path';

const moduleName = path.basename(module.filename);
export class BmqBackupRequestEventBus implements IBackupRequestEventBus {
	private bullMq: BullMq;
	private connection: ConnectionOptions;

	constructor(bullMq: BullMq, connection: ConnectionOptions) {
		this.bullMq = bullMq;
		this.connection = connection;
	}

	// exists(requestId: string): Promise<Result<boolean, AdapterErrors.EventBusError>>;
	public async publish(
		topicName: string,
		backupRequest: BackupRequest
	): Promise<Result<BackupRequest, AdapterErrors.EventBusError>> {
		const functionName = 'publish';

		const event = this.mapToQueue(backupRequest);
		console.log('publish', event);
		try {
			const queue = new this.bullMq.Queue(topicName, { connection: this.connection });
			const res = await queue.add(
				event.backupRequestId,
				{ event },
				{
					attempts: 3,
					backoff: {
						type: 'exponential',
						delay: 1000,
					},
					removeOnComplete: 100,
					removeOnFail: 100,
				}
			);

			return ok(backupRequest);
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
