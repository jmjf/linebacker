import { Result, ok, err } from '../../../common/core/Result';
import { BackupRequest } from '../../domain/BackupRequest';
import { IBackupRequestEventBus } from '../IBackupRequestEventBus';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';

import * as bullmq from 'bullmq';
import { ConnectionOptions } from 'bullmq';

export class BmqBackupRequestEventBus implements IBackupRequestEventBus {
	private bullMq: typeof bullmq;
	private connection: ConnectionOptions;

	constructor(bullMq: typeof bullmq, connection: ConnectionOptions) {
		this.bullMq = bullMq;
		this.connection = connection;
	}

	// exists(requestId: string): Promise<Result<boolean, AdapterErrors.EventBusError>>;
	public async add(
		topicName: string,
		backupRequest: BackupRequest
	): Promise<Result<BackupRequest, AdapterErrors.EventBusError>> {
		try {
			const queue = new this.bullMq.Queue(topicName, { connection: this.connection });
			const res = await queue.add(backupRequest.idValue, backupRequest);
			console.log('res', res);
			return ok(backupRequest);
		} catch (e) {
			return err(e as AdapterErrors.EventBusError);
		}
	}
}
