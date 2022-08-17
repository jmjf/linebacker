import { logger } from '../../../common/infrastructure/pinoLogger';
import { err, ok, Result } from '../../../common/core/Result';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';

import { BackupRequest } from '../../domain/BackupRequest';

//import { delay } from '../../../utils/utils';

import { IBackupRequestSendQueueAdapter } from '../BackupRequestSendQueueAdapter';

export interface IMockBRSQAdapterOptions {
	sendMessageResult?: boolean;
	sendMessageError?: AdapterErrors.SendQueueAdapterError;
}

export class MockBackupRequestSendQueueAdapter implements IBackupRequestSendQueueAdapter {
	sendMessageResult: boolean | undefined;
	sendMessageError: AdapterErrors.SendQueueAdapterError | undefined;

	constructor(opts: IMockBRSQAdapterOptions) {
		this.sendMessageResult = opts.sendMessageResult;
		this.sendMessageError = opts.sendMessageError;
	}

	async sendMessage(backupRequest: BackupRequest): Promise<Result<boolean, AdapterErrors.SendQueueAdapterError>> {
		//await delay(10000);
		logger.info({
			context: 'MockBRSQA.sendMessage',
			backupRequestId: backupRequest.idValue,
			backupJobId: backupRequest.backupJobId.value,
			msg: 'sendMessage',
		});
		if (typeof this.sendMessageResult === 'boolean') return ok(this.sendMessageResult);
		if (this.sendMessageError) return err(this.sendMessageError);
		return err(new AdapterErrors.SendQueueAdapterError(`{msg: 'no error provided'}`));
	}
}
