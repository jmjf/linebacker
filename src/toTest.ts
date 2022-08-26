import dotenv from 'dotenv';
dotenv.config({ path: './env/dev.env' });

import { BackupRequest } from './typeorm/entity/BackupRequest.entity';
import { toDataSource } from './typeorm/toDataSource';

async function main() {
	await toDataSource.initialize();
	console.log('toDataSource initialized');

	const find1 = await toDataSource.manager.find(BackupRequest);
	console.log('find result 1', find1);

	const br = {
		backupRequestId: 'test123',
		backupJobId: 'testjob',
		dataDate: new Date(),
		preparedDataPathName: 'prepared path',
		getOnStartFlag: true,
		transportTypeCode: 'TEST',
		backupProviderCode: 'CloudA',
		storagePathName: 'stored path',
		statusTypeCode: 'new',
		receivedTimestamp: new Date(),
	};

	const save1 = await toDataSource.manager.save(BackupRequest, br);
	console.log('save result 1', save1);

	const find2 = await toDataSource.manager.find(BackupRequest);
	console.log('find result 2', find2);
}

main();
