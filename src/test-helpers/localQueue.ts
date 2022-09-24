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
	return new QueueClient(`${process.env.AZURE_QUEUE_ACCOUNT_URI}/allowed-backup-requests`, cred);
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
	if (!(typeof action === 'string') || !['read', 'clear'].includes(action.toLowerCase())) {
		console.log('Unknown action', action);
		return;
	}

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
			await queueClient.clearMessages();
			break;
	}
}

main();