import { QueueClient, QueueReceiveMessageResponse, StorageSharedKeyCredential } from '@azure/storage-queue';
import dotenv from 'dotenv';

dotenv.config({ path: './env/dev.env' });

async function getQueueClient(): Promise<QueueClient | undefined> {
	const accountName = (process.env.SASK_ACCOUNT_NAME || '').trim();
	const accountKey = (process.env.SASK_ACCOUNT_KEY || '').trim();

	if (accountName.length < 1 || accountKey.length < 1) {
		console.error(`sharedkey authentication environment variables missing or empty`);
		return;
	}

	const cred = new StorageSharedKeyCredential(accountName, accountKey);
	return new QueueClient(`${process.env.AZURE_QUEUE_ACCOUNT_URI}/store-statuses`, cred);
}

async function readQueue(queueClient: QueueClient) {
	let res: QueueReceiveMessageResponse;
	do {
		try {
			res = await queueClient.receiveMessages();
			console.log(res.receivedMessageItems);
		} catch (e) {
			console.log(e);
			return;
		}
	} while (res.receivedMessageItems.length >= 1);
}

async function main() {
	const action = process.argv[2];

	const queueClient = await getQueueClient();
	if (queueClient === undefined) {
		console.log('Failed getting QueueClient');
		return;
	}

	switch (action.toLowerCase()) {
		case 'read':
			await readQueue(queueClient);
			break;
		case 'clear':
			console.log(await queueClient.clearMessages());
			break;
		case 'get-properties':
			console.log(await queueClient.getProperties());
			break;
		case 'send':
			console.log(
				await queueClient.sendMessage(
					JSON.stringify({
						backupRequestId: 'c5n_BDMMdE3xZPumw36MS',
						storagePathName: '/path/to/backup/storage',
						resultTypeCode: 'Succeeded',
						backupByteCount: 1000000,
						copyStartTimestamp: '2022-05-06T00:20:03.111Z',
						copyEndTimestamp: '2022-05-06T00:32:23.888Z',
						messageText: 'should be copied to the request (will expect)',

						verifyStartTimestamp: '2022-05-06T00:32:25.234Z',
						verifyEndTimestamp: '2022-05-06T00:45:22.784Z',
						verifiedHash: 'verify hash',
					})
				)
			);
	}
}

main();
