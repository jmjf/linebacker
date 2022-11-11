import { Result } from '../../common/core/Result';
import { BackupRequest } from '../domain/BackupRequest';
import * as AdapterErrors from '../../common/adapter/AdapterErrors';

export interface IBackupRequestEventBus {
	// exists(requestId: string): Promise<Result<boolean, AdapterErrors.EventBusError>>;
	add(topicName: string, backupRequest: BackupRequest): Promise<Result<BackupRequest, AdapterErrors.EventBusError>>;
}
