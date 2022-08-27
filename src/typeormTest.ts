import dotenv from 'dotenv';
dotenv.config({ path: './env/dev.env' });

import { TypeormBackupRequest } from './typeorm/entity/TypeormBackupRequest.entity';
import { typeormDataSource } from './typeorm/typeormDataSource';

async function main() {
	await typeormDataSource.initialize();
	console.log('typeormDataSource initialized');

	const find1 = await typeormDataSource.manager.find(TypeormBackupRequest);
	console.log('find result 1', find1);

	const br = {
		backupRequestId: 'test123',
		backupJobId: 'testjob',
		dataDate: new Date(),
		preparedDataPathName: 'prepared path',
		getOnStartFlag: true,
		transportTypeCode: 'TEST',
		backupProviderCode: 'CloudB',
		storagePathName: 'stored path',
		statusTypeCode: 'new',
		receivedTimestamp: new Date(),
	};

	const save1 = await typeormDataSource.manager.save(TypeormBackupRequest, br);
	console.log('save result 1', save1);

	const find2 = await typeormDataSource.manager.find(TypeormBackupRequest);
	console.log('find result 2', find2);
}

main();
