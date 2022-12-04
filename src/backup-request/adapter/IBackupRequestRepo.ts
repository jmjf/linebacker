import { Result } from '../../common/core/Result';
import * as DomainErrors from '../../common/domain/DomainErrors';
import * as AdapterErrors from '../../common/adapter/AdapterErrors';
import * as InfrastructureErrors from '../../common/infrastructure/InfrastructureErrors';

import { BackupRequest } from '../domain/BackupRequest';
import { BackupRequestStatusType } from '../domain/BackupRequestStatusType';

export interface IBackupRequestRepo {
	exists(requestId: string): Promise<Result<boolean, AdapterErrors.DatabaseError>>;
	getById(
		requestId: string
	): Promise<Result<BackupRequest, AdapterErrors.DatabaseError | AdapterErrors.NotFoundError>>;
	getByStatusBeforeTimestamp(
		status: BackupRequestStatusType,
		beforeTimestamp: Date
	): Promise<
		Result<
			Result<BackupRequest, DomainErrors.PropsError>[],
			AdapterErrors.DatabaseError | AdapterErrors.NotFoundError
		>
	>;
	save(
		backupRequest: BackupRequest
	): Promise<Result<BackupRequest, AdapterErrors.DatabaseError | InfrastructureErrors.EventBusError>>;
}
