import { logger } from '../../../common/infrastructure/pinoLogger';
import { delay } from '../../../utils/utils';
import { BackupRequest } from '../../domain/BackupRequest';
import { IBackupRequestBackupInterfaceAdapter } from '../BackupRequestBackupInterfaceAdapter';

export class MockBackupRequestBackupInterfaceAdapter
	implements IBackupRequestBackupInterfaceAdapter
{
	async sendMessage(backupRequest: BackupRequest): Promise<boolean> {
		//await delay(10000);
		logger.info({
			context: 'MockBRBIA.sendMessage',
			backupRequestId: backupRequest.idValue,
			backupJobId: backupRequest.backupJobId.value,
			msg: 'sendMessage',
		});
		return true;
	}
}
