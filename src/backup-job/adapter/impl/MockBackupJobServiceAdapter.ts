import { Result } from '../../../common/core/Result';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';

import { BackupJob } from '../../domain/BackupJob';
import { BackupProviderTypeValues } from '../../domain/BackupProviderType';
import { IBackupJobServiceAdapter } from '../BackupJobServiceAdapter';
import { delay } from '../../../utils/utils';
import { logger } from '../../../common/infrastructure/pinoLogger';

const backupJobProps = {
	storagePathName: 'storagePathName',
	backupProviderCode: BackupProviderTypeValues.CloudA,
	daysToKeep: 100,
	isActive: true,
	holdFlag: false,
};

export class MockBackupJobServiceAdapter implements IBackupJobServiceAdapter {
	async getById(
		backupJobId: string,
		backupRequestId: string
	): Promise<Result<BackupJob, AdapterErrors.BackupJobServiceError>> {
		//await delay(10000);
		logger.info({
			context: 'MockBJSA.getById',
			backupRequestId: backupRequestId,
			backupJobId: backupJobId,
			msg: 'getById',
		});
		return BackupJob.create(
			backupJobProps,
			new UniqueIdentifier(backupJobId)
		);
	}
}
