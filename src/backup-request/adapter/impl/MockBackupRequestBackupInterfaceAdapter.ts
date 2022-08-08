import { delay } from '../../../utils/utils';
import { BackupRequest } from '../../domain/BackupRequest';
import { IBackupRequestBackupInterfaceAdapter } from '../BackupRequestBackupInterfaceAdapter';

export class MockBackupRequestBackupInterfaceAdapter
	implements IBackupRequestBackupInterfaceAdapter
{
	async sendMessage(backupRequest: BackupRequest): Promise<boolean> {
		//await delay(10000);
		console.log(
			`{ location: 'MockBRBIA sendMessage', backupRequest: {${JSON.stringify(
				backupRequest
			)}}`
		);
		return true;
	}
}
