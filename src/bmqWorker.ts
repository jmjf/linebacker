import dotenv from 'dotenv';
import { logger } from './infrastructure/logging/pinoLogger';
logger.setBindings({
	service: 'accepted-consumer',
	feature: 'store',
	pm2ProcessId: process.env.pm_id,
	pm2InstanceId: process.env.PM2_INSTANCE_ID,
});

const logContext = { location: 'BullMQ Worker', functionName: 'pre-start' };

logger.info(logContext, 'getting environment');
if (!process.env.APP_ENV) {
	logger.error(logContext, 'APP_ENV is falsey');
	process.exit(1);
}

logger.info(logContext, `APP_ENV ${process.env.APP_ENV}`);
dotenv.config({ path: `./env/${process.env.APP_ENV}.env` });

if (process.env.EVENT_BUS_TYPE !== 'bullmq') {
	logger.error(logContext, 'EVENT_BUS_TYPE is not bullmq');
	process.exit(1);
}

import * as bullMq from 'bullmq';
import path from 'node:path';

import { delay } from './common/utils/utils';

import { typeormDataSource } from './infrastructure/typeorm/typeormDataSource';
import { typeormCtx } from './infrastructure/typeorm/typeormContext';
import { buildCircuitBreakers, ICircuitBreakers } from './infrastructure/typeorm/buildCircuitBreakers.typeorm';
import { bullMqConnection } from './common/infrastructure/event-bus/eventBus';

import { eventBus } from './common/infrastructure/event-bus/eventBus';
import { TypeormBackupRequestRepo } from './backup-request/adapter/impl/TypeormBackupRequestRepo';

import { BullmqConsumer } from './common/infrastructure/event-bus/BullmqConsumer';

import { MockBackupJobServiceAdapter } from './backup-job/adapter/impl/MockBackupJobServiceAdapter';
import { BackupProviderTypeValues } from './backup-job/domain/BackupProviderType';

import { ReceiveBackupRequestUseCase } from './backup-request/use-cases/receive-backup-request/ReceiveBackupRequestUseCase';
import { CheckRequestAllowedUseCase } from './backup-request/use-cases/check-request-allowed-2/CheckRequestAllowedUseCase';
import { SendRequestToInterfaceUseCase } from './backup-request/use-cases/send-request-to-interface/SendRequestToInterfaceUseCase';
import { ReceiveStoreStatusReplyUseCase } from './backup-request/use-cases/receive-store-status-reply/ReceiveStoreStatusReplyUseCase';
import { AzureBackupInterfaceStoreAdapter } from './backup-request/adapter/impl/AzureBackupInterfaceStoreAdapter';
import { TypeormBackupRepo } from './backup/adapter/impl/TypeormBackupRepo';

const moduleName = path.basename(module.filename);

const buildWorker = (circuitBreakers: ICircuitBreakers) => {
	const ensureNumber = (str: string | undefined, alt: number) => {
		return str && !isNaN(parseInt(str)) ? parseInt(str) : alt;
	};
	const startDelayMs = Math.max(1, ensureNumber(process.env.EVENT_BUS_START_DELAY_MS, 1000));
	const maxDelayMs = Math.max(1, ensureNumber(process.env.EVENT_BUS_MAX_DELAY_MS, 60000));

	const brRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreakers.dbCircuitBreaker);

	const rcvUseCase = new ReceiveBackupRequestUseCase(brRepo, eventBus);
	const acceptedConsumer = new BullmqConsumer(rcvUseCase, 5);
	const consumeAccepted = acceptedConsumer.consume.bind(acceptedConsumer);

	const jobSvc = new MockBackupJobServiceAdapter({
		getByIdResult: {
			storagePathName: 'my/storage/path',
			backupProviderCode: BackupProviderTypeValues.CloudA,
			daysToKeep: 3650,
			isActive: true,
			holdFlag: false,
		},
	});

	const checkUseCase = new CheckRequestAllowedUseCase(brRepo, jobSvc, eventBus);
	const receivedConsumer = new BullmqConsumer(checkUseCase, 5);
	const consumeReceived = receivedConsumer.consume.bind(receivedConsumer);

	const azureInterfaceAdapter = new AzureBackupInterfaceStoreAdapter(
		'allowed-backup-requests',
		circuitBreakers.azureQueueCircuitBreaker
	);
	const azureSendUseCase = new SendRequestToInterfaceUseCase({
		backupRequestRepo: brRepo,
		interfaceStoreAdapter: azureInterfaceAdapter,
	});
	const azureAllowedConsumer = new BullmqConsumer(azureSendUseCase, 5);
	const consumeAllowed = azureAllowedConsumer.consume.bind(azureAllowedConsumer);

	const backupRepo = new TypeormBackupRepo(typeormCtx, circuitBreakers.dbCircuitBreaker);
	const receiveStoreStatusReplyUseCase = new ReceiveStoreStatusReplyUseCase({
		backupRequestRepo: brRepo,
		backupRepo,
		backupJobServiceAdapter: jobSvc,
	});
	const receiveStoreStatusReplyConsumer = new BullmqConsumer(receiveStoreStatusReplyUseCase, 5);
	const consumeReceiveStoreStatusReply = receiveStoreStatusReplyConsumer.consume.bind(receiveStoreStatusReplyConsumer);

	return new bullMq.Worker(
		'linebacker',
		async (job: bullMq.Job) => {
			const functionName = 'workerProcessor';
			switch (job.data.eventType) {
				case 'BackupRequestAccepted':
					await consumeAccepted(job);
					break;
				case 'BackupRequestReceived':
					await consumeReceived(job);
					break;
				case 'BackupRequestAllowed':
					await consumeAllowed(job);
					break;
				case 'StoreStatusReceived_BMQ':
					await consumeReceiveStoreStatusReply(job);
					break;
				case 'ApplicationResilienceReady':
					logger.debug(
						{ jobName: job.name, jobData: job.data, moduleName, functionName },
						'Skipping ApplicationResilienceReady'
					);
					break;
				default:
					logger.error({ jobName: job.name, jobData: job.data, moduleName, functionName }, 'Unknown event name');
					// throwing fails the job, doesn't halt the worker
					throw new Error('unknown event');
			}
		},
		{
			autorun: false,
			connection: bullMqConnection,
			lockDuration: 30000,
			settings: {
				backoffStrategy: (attemptsMade = 1, type, err, job) => {
					const delayMs = Math.min(startDelayMs * 3 ** attemptsMade, maxDelayMs);
					logger.trace(
						{ eventType: job?.data.eventType, jobName: job?.name, attemptsMade, delayMs },
						'Backoff delay'
					);
					return delayMs;
				},
			},
		}
	);
};

const startWorker = async () => {
	const functionName = 'startWorker';
	const logContext = { location: 'BullMQ Worker', functionName };

	logger.info(logContext, 'initializing TypeORM data source');
	await typeormDataSource.initialize();

	logger.info(logContext, 'configuring circuit breakers');
	const appAbortController = new AbortController();
	const circuitBreakers = buildCircuitBreakers(appAbortController.signal);

	const worker = buildWorker(circuitBreakers);
	await delay(10000);
	logger.info('Starting worker');
	try {
		worker.run();
	} catch (e) {
		logger.error({ error: e, moduleName, functionName }, `Caught error after worker.run()`);
		appAbortController.abort();
		await worker.close(); // gracefully shutdown the worker and release job locks
		await delay(5000);
		process.exit(1);
	}
};

startWorker();
