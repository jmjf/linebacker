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
import { AzureBackupInterfaceStoreAdapter } from './backup-request/adapter/impl/AzureBackupInterfaceStoreAdapter';

const moduleName = path.basename(module.filename);

const buildWorker = (circuitBreakers: ICircuitBreakers) => {
	const brRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreakers.dbCircuitBreaker);

	const rcvUseCase = new ReceiveBackupRequestUseCase(brRepo, eventBus);
	const acceptedConsumer = new BullmqConsumer(rcvUseCase, 5);
	const acceptedConsumerConsume = acceptedConsumer.consume.bind(acceptedConsumer);

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
	const receivedConsumerConsume = receivedConsumer.consume.bind(receivedConsumer);

	const azureInterfaceAdapter = new AzureBackupInterfaceStoreAdapter(
		'allowed-backup-requests',
		circuitBreakers.azureQueueCircuitBreaker
	);
	const azureSendUseCase = new SendRequestToInterfaceUseCase({
		backupRequestRepo: brRepo,
		interfaceStoreAdapter: azureInterfaceAdapter,
	});
	const azureAllowedConsumer = new BullmqConsumer(azureSendUseCase, 5);
	const azureAllowedConsumerConsume = azureAllowedConsumer.consume.bind(azureAllowedConsumer);

	return new bullMq.Worker(
		'linebacker',
		async (job: bullMq.Job) => {
			switch (job.data.eventName) {
				case 'BackupRequestAccepted':
					acceptedConsumerConsume(job);
					break;
				case 'BackupRequestReceived':
					receivedConsumerConsume(job);
					break;
				case 'BackupRequestAllowed':
					azureAllowedConsumerConsume(job);
					break;
				default:
					logger.error(
						{ jobName: job.name, jobData: job.data, moduleName, functionName: 'workerProcessor' },
						'Unknown event name'
					);
					// throwing fails the job, doesn't halt the worker
					throw new Error('unknown event');
			}
		},
		{
			autorun: false,
			connection: bullMqConnection,
			lockDuration: 30000,
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
		await delay(5000);
		process.exit(1);
	}
};

startWorker();
