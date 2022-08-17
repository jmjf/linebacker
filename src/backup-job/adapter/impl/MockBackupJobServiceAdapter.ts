import { err, Result } from '../../../common/core/Result';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';
import * as DomainErrors from '../../../common/domain/DomainErrors';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';

import { BackupJob, IBackupJobProps } from '../../domain/BackupJob';
import { BackupProviderTypeValues } from '../../domain/BackupProviderType';
import { IBackupJobServiceAdapter } from '../BackupJobServiceAdapter';
//import { delay } from '../../../utils/utils';
import { logger } from '../../../common/infrastructure/pinoLogger';

export const mockBackupJobProps = {
	storagePathName: 'storagePathName',
	backupProviderCode: BackupProviderTypeValues.CloudA,
	daysToKeep: 100,
	isActive: true,
	holdFlag: false,
};

export interface IMockBackupJobServiceAdapterResult {
	getByIdResult?: IBackupJobProps;
	getByIdError?: AdapterErrors.NotFoundError | AdapterErrors.BackupJobServiceError | DomainErrors.PropsError;
}

export class MockBackupJobServiceAdapter implements IBackupJobServiceAdapter {
	getByIdResult: IBackupJobProps | undefined;
	getByIdError:
		| AdapterErrors.NotFoundError
		| AdapterErrors.BackupJobServiceError
		| DomainErrors.PropsError
		| undefined;

	constructor(opts: IMockBackupJobServiceAdapterResult) {
		this.getByIdResult = opts.getByIdResult;
		this.getByIdError = opts.getByIdError;
	}

	async getById(
		backupJobId: string,
		backupRequestId?: string
	): Promise<
		Result<BackupJob, AdapterErrors.BackupJobServiceError | AdapterErrors.NotFoundError | DomainErrors.PropsError>
	> {
		//await delay(10000);
		logger.info({
			context: 'MockBJSA.getById',
			backupRequestId: backupRequestId,
			backupJobId: backupJobId,
			msg: 'getById',
		});
		if (this.getByIdResult) return this.mapToDomain({ ...this.getByIdResult, backupJobId });
		if (this.getByIdError) return err(this.getByIdError);
		return err(new AdapterErrors.BackupJobServiceError(`{msg: 'unknown'}`));
	}

	mapToDomain(raw: any) {
		const { backupJobId, ...otherProps } = raw;
		return BackupJob.create(otherProps, new UniqueIdentifier(backupJobId));
	}
}
