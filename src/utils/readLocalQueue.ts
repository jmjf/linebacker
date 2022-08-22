import { QueueClient, QueueReceiveMessageResponse, StorageSharedKeyCredential } from '@azure/storage-queue';
import dotenv from 'dotenv';

dotenv.config({ path: './env/dev.env' });

async function main() {
	const accountName = (process.env.SASK_ACCOUNT_NAME || '').trim();
	const accountKey = (process.env.SASK_ACCOUNT_KEY || '').trim();

	if (accountName.length < 1 || accountKey.length < 1) {
		console.error(`sharedkey authentication environment variables missing or empty`);
		return;
	}

	const cred = new StorageSharedKeyCredential(accountName, accountKey);
	const queueClient = new QueueClient(`${process.env.AZURE_QUEUE_ACCOUNT_URI}/allowed-backup-requests`, cred);

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

main();
