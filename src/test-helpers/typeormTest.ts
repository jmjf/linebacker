import dotenv from 'dotenv';
dotenv.config({ path: './env/dev.env' });

import { TypeormBackupRequest } from '../infrastructure/typeorm/entity/TypeormBackupRequest.entity';
import { TypeormBackup } from '../infrastructure/typeorm/entity/TypeormBackup.entity';
import { typeormDataSource } from '../infrastructure/typeorm/typeormDataSource';

async function main() {
	await typeormDataSource.initialize();
	console.log('typeormDataSource initialized');

	const find1 = await typeormDataSource.manager.find(TypeormBackupRequest, {
		where: { backupRequestId: 'abc' },
	});
	console.log('find result 1', find1);

	// const br = {
	// 	backupRequestId: 'test123',
	// 	backupJobId: 'testjob',
	// 	dataDate: new Date(),
	// 	preparedDataPathName: 'prepared path',
	// 	getOnStartFlag: true,
	// 	transportTypeCode: 'TEST',
	// 	backupProviderCode: 'CloudB',
	// 	storagePathName: 'stored path',
	// 	statusTypeCode: 'new',
	// 	receivedTimestamp: new Date(),
	// };

	// const save1 = await typeormDataSource.manager.save(TypeormBackupRequest, br);
	// console.log('save result 1', save1);

	// const find2 = await typeormDataSource.manager.find(TypeormBackupRequest);
	// console.log('find result 2', find2);

	// const bkup = {
	// 	backupId: 'backup123',
	// 	backupRequestId: 'backupRequest123',
	// 	backupJobId: 'backupJob123',
	// 	dataDate: new Date(),
	// 	storagePathName: 'storage path',
	// 	backupProviderCode: 'Local',
	// 	daysToKeepCount: 123456,
	// 	holdFlag: false,
	// 	backupByteCount: Number.MAX_SAFE_INTEGER.toString(),
	// 	copyStartTimestamp: new Date(),
	// 	copyEndTimestamp: new Date(),
	// };

	// const saveBackup = await typeormDataSource.manager.save(TypeormBackup, bkup);
	// console.log('save backup result', saveBackup);

	// const findBackup = await typeormDataSource.manager.find(TypeormBackup);
	// console.log('find backup result', findBackup, Number.parseInt(findBackup[0].backupByteCount));
}

main();
