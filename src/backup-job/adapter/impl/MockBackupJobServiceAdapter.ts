import { Result } from '../../../common/core/Result';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';

import { BackupJob } from '../../domain/BackupJob';
import { BackupProviderTypeValues } from '../../domain/BackupProviderType';
import { IBackupJobServiceAdapter } from '../BackupJobServiceAdapter';
import { delay } from '../../../utils/utils';

const backupJobProps = {
	storagePathName: 'storagePathName',
	backupProviderCode: BackupProviderTypeValues.CloudA,
	daysToKeep: 100,
	isActive: true,
	holdFlag: false,
};

export class MockBackupJobServiceAdapter implements IBackupJobServiceAdapter {
	async getBackupJob(
		backupJobId: string
	): Promise<Result<BackupJob, AdapterErrors.BackupJobServiceError>> {
		//await delay(10000);
		return BackupJob.create(
			backupJobProps,
			new UniqueIdentifier(backupJobId)
		);
	}
}
