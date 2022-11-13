import { Kafka, logLevel } from 'kafkajs';
import { BackupRequest } from '../../backup-request/domain/BackupRequest';
import { BackupRequestStatusTypeValues } from '../../backup-request/domain/BackupRequestStatusType';
import { KBackupRequestAccepted } from '../../backup-request/domain/KBackupRequestAccepted';
import { RequestTransportTypeValues } from '../../backup-request/domain/RequestTransportType';
import { UniqueIdentifier } from '../../common/domain/UniqueIdentifier';
import { KafkajsAdapter } from '../../common/messaging/KafkajsAdapter';
import { delay } from '../../common/utils/utils';

const produce = async (delayMs: number) => {
	const adapter = new KafkajsAdapter({
		clientId: '1802-01-producer',
		brokers: ['localhost:19093', 'localhost:29093', 'localhost:39093'],
		connectionTimeout: 3000,
		requestTimeout: 30000,
		logLevel: logLevel.INFO,
	});

	for (const msg of ['15', '10', '5']) {
		console.log(`wait ${msg}`);
		await delay(5000);
	}

	const props = {
		dataDate: new Date('2022-08-01'),
		preparedDataPathName: 'test-path',
		statusTypeCode: BackupRequestStatusTypeValues.Accepted,
		transportTypeCode: RequestTransportTypeValues.HTTP,
		getOnStartFlag: true,
		requesterId: 'requester',
	};

	for (let i = 0; i < 5; i++) {
		const backupJobId = new UniqueIdentifier(`job-000${i}`);
		console.log('backupJobId', backupJobId.value);
		const result = BackupRequest.create({
			...props,
			backupJobId,
			receivedTimestamp: new Date(),
		});
		if (result.isErr()) {
			console.log('create error', result.error);
			break;
		}

		const message = new KBackupRequestAccepted(result.value);

		const publishResult = await adapter.publish(message);
		console.log(`published ${i}`, publishResult);
		await delay(delayMs);
	}
};

const run = async () => {
	produce(3000);
};

run().catch(console.error);
