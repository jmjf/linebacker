import express, { Response, Router } from 'express';
import * as dotenv from 'dotenv';
import { logger } from '../infrastructure/logging/pinoLogger';
import {
	QueueClient,
	QueueItem,
	QueueServiceClient,
	ReceivedMessageItem,
	StorageSharedKeyCredential,
} from '@azure/storage-queue';

const logContext = { location: 'Queue helper', function: 'pre-start' };

logger.info(logContext, 'getting environment');
if (!process.env.APP_ENV) {
	logger.error(logContext, 'APP_ENV is falsey');
	process.exit(1);
}

logger.info(logContext, `APP_ENV ${process.env.APP_ENV}`);
dotenv.config({ path: `./env/${process.env.APP_ENV}.env` });

if (!process.env.API_PORT || process.env.API_PORT.length === 0) {
	logger.error(logContext, 'API_PORT is falsey or empty');
	process.exit(1);
}
const apiPort = parseInt(process.env.API_PORT) + 5;
logger.info(logContext, `apiPort ${apiPort}`);

async function getQueueServiceClient(): Promise<QueueServiceClient> {
	const accountName = (process.env.SASK_ACCOUNT_NAME || '').trim();
	const accountKey = (process.env.SASK_ACCOUNT_KEY || '').trim();

	if (accountName.length < 1 || accountKey.length < 1) {
		const err = new Error('sharedkey authentication environment variables missing or empty');
		logger.error(err, err.message);
		throw err;
	}

	const cred = new StorageSharedKeyCredential(accountName, accountKey);
	return new QueueServiceClient(`${process.env.AZURE_QUEUE_ACCOUNT_URI}`, cred);
}

async function getQueueClient(queueName: string): Promise<QueueClient> {
	const queueServiceClient = await getQueueServiceClient();
	return queueServiceClient?.getQueueClient(queueName);
}

function formatError(e: unknown) {
	const { message, name, stack } = e as Error;
	return {
		message,
		name,
		stack,
	};
}

async function callQcMethod(res: Response, methodName: string, queueName: string) {
	try {
		const qc = await getQueueClient(queueName);
		// eslint-disable-next-line @typescript-eslint/ban-types
		const qcResult = await (qc as unknown as Record<string, Function>)[methodName]();
		res.status(qcResult._response?.status || 200).send(qcResult);
	} catch (e) {
		res.status(500).send(formatError(e));
	}
}

const router = Router();

// queues routes

// GET /queues -> get list of queue names
router.get('/queues', async (req, res) => {
	try {
		const qsc = await getQueueServiceClient();
		const queues: string[] = [];
		for await (const item of qsc.listQueues()) {
			queues.push(item.name);
		}
		res.status(200).send(queues);
	} catch (e) {
		res.status(500).send(formatError(e));
	}
});

// GET /queues/:queueName -> get data about the named queue
router.get('/queues/:queueName', (req, res) => {
	callQcMethod(res, 'getProperties', req.params.queueName);
});

// PUT /queues/:queueName -> create named queue if it doesn't exist
router.put('/queues/:queueName', (req, res) => {
	callQcMethod(res, 'createIfNotExists', req.params.queueName);
});

// DELETE /queues/:queueName -> delete named queue
router.delete('/queues/:queueName', (req, res) => {
	callQcMethod(res, 'delete', req.params.queueName);
});

// messages routes

// GET /messages?queueName=:queueName -> get messages from named queue
router.get('/messages', async (req, res) => {
	const queueName = req.query.queueName as string;
	if (!queueName) res.status(400).send('missing queue name');

	try {
		const qc = await getQueueClient(queueName);
		if (!(await qc.exists())) {
			res.status(400).send(`${queueName} does not exist`);
			return;
		}

		let msgCount = 32;
		const messages: ReceivedMessageItem[] = [];
		while (msgCount >= 32) {
			const getMsgResult = await qc.receiveMessages({ numberOfMessages: 32 });
			messages.push(
				...getMsgResult.receivedMessageItems.map((msg) => {
					// parse messageText if possible, otherwise {}
					let parsedMessageText = {};
					try {
						parsedMessageText = JSON.parse(msg.messageText);
					} catch (e) {
						// do nothing
					}
					return { ...msg, parsedMessageText };
				})
			);
			msgCount = getMsgResult.receivedMessageItems.length;
		}
		res.status(200).send(messages);
	} catch (e) {
		res.status(500).send(formatError(e));
	}
});

// POST /messages -> post message from body in queue named in body: { queueName: string, message: object | string }
router.post('/messages', async (req, res) => {
	if (
		!req.body ||
		!req.body.queueName ||
		typeof req.body.queueName !== 'string' ||
		!req.body.message ||
		(typeof req.body.message !== 'object' && typeof req.body.message !== 'string')
	)
		res.status(400).send('Body must be { queueName: string, message: object | string}');

	try {
		const qc = await getQueueClient(req.body.queueName);
		if (!(await qc.exists())) {
			res.status(400).send(`${req.body.queueName} does not exist`);
			return;
		}

		const message = typeof req.body.message === 'object' ? JSON.stringify(req.body.message) : req.body.message;
		const sendResult = await qc.sendMessage(message);
		const { _response, ...restOfResult } = sendResult;
		res.status(_response.status).send({
			status: _response.status,
			...restOfResult,
		});
	} catch (e) {
		res.status(500).send(formatError(e));
	}
});

// DELETE /messages -> delete message identified in body: { queueName: string, messageId: string, popReceipt: string }

router.delete('/messages', async (req, res) => {
	if (
		!req.body ||
		!req.body.queueName ||
		typeof req.body.queueName !== 'string' ||
		!req.body.messageId ||
		typeof req.body.messageId !== 'string' ||
		!req.body.popReceipt ||
		typeof req.body.popReceipt !== 'string'
	)
		res.status(400).send('Body must be { queueName: string , messageId: string, popReceipt: string }');

	try {
		const qc = await getQueueClient(req.body.queueName);
		const delResult = await qc.deleteMessage(req.body.messageId, req.body.popReceipt);
		res.status(delResult._response.status).send(delResult);
	} catch (e) {
		res.status(500).send(formatError(e));
	}
});

// start the server

const app = express();
app.use(express.json());
app.use('/api', router);
app.listen(apiPort);
logger.info(logContext, `Listening on ${apiPort}`);
