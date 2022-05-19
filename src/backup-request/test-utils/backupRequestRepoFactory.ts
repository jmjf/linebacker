import { Result, ok, err } from '../../common/core/Result';
import { DomainEventBus } from '../../common/domain/DomainEventBus';
import * as ApplicationErrors from '../../common/application/ApplicationErrors';

import { IBackupRequestRepo } from '../adapter/BackupRequestRepo';
import { BackupRequest } from '../domain/BackupRequest';


interface IBackupRequestRepoFactoryParams {
	existsResult?: boolean;
	getByIdResult?: BackupRequest;
}
export function backupRequestRepoFactory(
	params?: IBackupRequestRepoFactoryParams
): IBackupRequestRepo {
	return <IBackupRequestRepo>{
		exists(requestId: string): Promise<boolean> {
			return Promise.resolve(params?.existsResult === undefined || params?.existsResult === null ? true : params?.existsResult);
		},

		async getById(requestId: string): Promise<Result<BackupRequest, ApplicationErrors.UnexpectedError>> {
			if (!params || !params.getByIdResult || !requestId) {
				return Promise.resolve(err(new ApplicationErrors.UnexpectedError('BackupRequestRepo getByIdResult not found')));
			}
			return Promise.resolve(ok(params.getByIdResult));
		},

		save(backupRequest: BackupRequest): Promise<Result<BackupRequest, ApplicationErrors.UnexpectedError>> {
			DomainEventBus.publishEventsForAggregate(backupRequest.backupRequestId);
			return Promise.resolve(ok(backupRequest));
		},
	};
}
