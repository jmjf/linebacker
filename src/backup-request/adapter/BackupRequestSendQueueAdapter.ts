import { Result } from '../../common/core/Result';
import * as AdapterErrors from '../../common/adapter/AdapterErrors';

import { BackupRequest } from '../domain/BackupRequest';

export interface IBackupRequestSendQueueAdapter {
	sendMessage(backupRequest: BackupRequest): Promise<Result<boolean, AdapterErrors.SendQueueAdapterError>>; // may be void if circuit breaker keeps a queue of messages
}
