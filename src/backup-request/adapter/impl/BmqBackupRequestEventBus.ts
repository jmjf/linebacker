import { Result, ok, err } from '../../../common/core/Result';
import { BackupRequest } from '../../domain/BackupRequest';
import { IBackupRequestEventBus } from '../IBackupRequestEventBus';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';

import { ConnectionOptions } from 'bullmq';
import { BullMq } from '../../../infrastructure/bullmq/bullMqInfra';

export class BmqBackupRequestEventBus implements IBackupRequestEventBus {
	private bullMq: BullMq;
	private connection: ConnectionOptions;

	constructor(bullMq: BullMq, connection: ConnectionOptions) {
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
			return ok(backupRequest);
		} catch (e) {
			return err(e as AdapterErrors.EventBusError);
		}
	}
}
