import path from 'node:path';
import express, { Response, Router } from 'express';
import { QueueClient, QueueServiceClient, ReceivedMessageItem, StorageSharedKeyCredential } from '@azure/storage-queue';

import { appState, isAppStateUsable } from '../infrastructure/app-state/appState';
import { logger } from '../infrastructure/logging/pinoLogger';

const moduleName = path.basename(module.filename);
const serviceName = 'queue-helper';
const featureName = 'api';

async function getQueueServiceClient(): Promise<QueueServiceClient> {
	const cred = new StorageSharedKeyCredential(appState.azureQueue_saskAccountName, appState.azureQueue_saskAccountKey);
	return new QueueServiceClient(appState.azureQueue_queueAccountUri, cred);
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

const logContext = { moduleName, functionName: 'startServer' };

logger.setBindings({
	serviceName,
	featureName,
	pm2ProcessId: appState.pm2_processId,
	pm2InstanceId: appState.pm2_instanceId,
});

const requiredStateMembers = ['linebackerApi_port', 'azureQueue_authMethod', 'azureQueue_queueAccountUri'];
if (
	!isAppStateUsable(requiredStateMembers) ||
	// sask additional
	(appState.azureQueue_authMethod.toLowerCase() === 'sask' &&
		!isAppStateUsable(['azureQueue_saskAccountName', 'azureQueue_saskAccountKey'])) ||
	// app registration additional
	(appState.azureQueue_authMethod.toLowerCase() === 'adcc' &&
		!isAppStateUsable(['azureQueue_tenantId', 'azureQueue_clientId', 'azureQueue_clientSecret']))
) {
	logger.fatal(logContext, 'Required environment variables missing or invalid');
	process.exit(1);
}

const app = express();
app.use(express.json());
app.use('/api', router);
app.listen(appState.linebackerApi_port + 55);
logger.info(logContext, `Listening on ${appState.linebackerApi_port + 55}`);
