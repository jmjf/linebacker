import { logger } from '../../../common/infrastructure/pinoLogger';
import { err, ok, Result } from '../../../common/core/Result';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';

import { BackupRequest } from '../../domain/BackupRequest';

//import { delay } from '../../../utils/utils';

import {
	IBackupInterfaceStoreAdapter,
	StoreDeleteResponse,
	StoreReceiveResponse,
	StoreSendResponse,
} from '../IBackupInterfaceStoreAdapter';

export interface IMockBRSQAdapterOptions {
	sendMessageResult?: boolean;
	sendMessageError?: AdapterErrors.InterfaceAdapterError;
}

export class MockBackupInterfaceStoreAdapter implements IBackupInterfaceStoreAdapter {
	sendMessageResult: boolean | undefined;
	sendMessageError: AdapterErrors.InterfaceAdapterError | undefined;

	constructor(opts: IMockBRSQAdapterOptions) {
		this.sendMessageResult = opts.sendMessageResult;
		this.sendMessageError = opts.sendMessageError;
	}

	async send(backupRequest: BackupRequest): Promise<Result<StoreSendResponse, AdapterErrors.InterfaceAdapterError>> {
		const startTime = new Date();
		//awaitendTime10000);
		logger.info({
			context: 'MockBRSQA.sendMessage',
			backupRequestId: backupRequest.idValue,
			backupJobId: backupRequest.backupJobId.value,
			msg: 'sendMessage',
		});
		const endTime = new Date();
		if (typeof this.sendMessageResult === 'boolean')
			return ok({
				backupRequestId: backupRequest.backupRequestId.value,
				isSent: this.sendMessageResult,
				startTime,
				endTime,
				responseStatus: 201,
			});
		if (this.sendMessageError) return err(this.sendMessageError);
		return err(new AdapterErrors.InterfaceAdapterError(JSON.stringify({ msg: 'no error provided' })));
	}

	async receive(messageCount: number): Promise<Result<StoreReceiveResponse, AdapterErrors.InterfaceAdapterError>> {
		return ok({} as StoreReceiveResponse);
	}

	async delete(
		messageId: string,
		popReceipt: string
	): Promise<Result<StoreDeleteResponse, AdapterErrors.InterfaceAdapterError>> {
		return ok({} as StoreDeleteResponse);
	}

	async isReady(): Promise<Result<boolean, AdapterErrors.InterfaceAdapterError>> {
		return ok(true);
	}
}
