import { Result, ok, err } from '../../../common/core/Result';
import { BackupRequest } from '../../domain/BackupRequest';
import { IBackupRequestEventBus } from '../IBackupRequestEventBus';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';

import * as bullmq from 'bullmq';

export class BmqBackupRequestEventBus implements IBackupRequestEventBus {
	private bullMq: typeof bullmq;

	constructor(bullMq: typeof bullmq) {
		this.bullMq = bullMq;
	}

	// exists(requestId: string): Promise<Result<boolean, AdapterErrors.EventBusError>>;
	public async add(backupRequest: BackupRequest): Promise<Result<BackupRequest, AdapterErrors.EventBusError>> {
		try {
			const queue = new this.bullMq.Queue('test');
			await queue.add(backupRequest.idValue, backupRequest);
			return ok(backupRequest);
		} catch (e) {
			return err(e as AdapterErrors.EventBusError);
		}
	}
}
