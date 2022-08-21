import { Result } from '../../common/core/Result';
import * as AdapterErrors from '../../common/adapter/AdapterErrors';

import { BackupRequest } from '../domain/BackupRequest';

export interface SendMessageResponse {
	backupRequestId: string;
	isSent: boolean;
	responseStatus: number;
	sendStart: Date;
	sendEnd: Date;
	insertedOn?: Date;
	messageId?: string;
	sendRequestId?: string;
}

export interface IBackupRequestSendQueueAdapter {
	sendMessage(backupRequest: BackupRequest): Promise<Result<SendMessageResponse, AdapterErrors.SendQueueAdapterError>>; // may be void if circuit breaker keeps a queue of messages
}
