import path from 'node:path';
import * as bullMq from 'bullmq';

import { appState, isAppStateUsable } from './infrastructure/app-state/appState';
import { logger } from './infrastructure/logging/pinoLogger';

import { typeormDataSource } from './infrastructure/typeorm/typeormDataSource';
import { typeormCtx } from './infrastructure/typeorm/typeormContext';
import { buildCircuitBreakers, ICircuitBreakers } from './infrastructure/typeorm/buildCircuitBreakers.typeorm';

import { delay } from './common/utils/utils';
import { bullMqConnection } from './common/infrastructure/event-bus/eventBus';
import { eventBus } from './common/infrastructure/event-bus/eventBus';
import { BullmqConsumer } from './common/infrastructure/event-bus/BullmqConsumer';

import { MockBackupJobServiceAdapter } from './backup-job/adapter/impl/MockBackupJobServiceAdapter';
import { BackupProviderTypeValues } from './backup-job/domain/BackupProviderType';

import { ReceiveBackupRequestUseCase } from './backup-request/use-cases/receive-backup-request/ReceiveBackupRequestUseCase';
import { CheckRequestAllowedUseCase } from './backup-request/use-cases/check-request-allowed-2/CheckRequestAllowedUseCase';
import { SendRequestToInterfaceUseCase } from './backup-request/use-cases/send-request-to-interface/SendRequestToInterfaceUseCase';
import { ReceiveStoreStatusReplyUseCase } from './backup-request/use-cases/receive-store-status-reply/ReceiveStoreStatusReplyUseCase';
import { AzureBackupInterfaceStoreAdapter } from './backup-request/adapter/impl/AzureBackupInterfaceStoreAdapter';
import { TypeormBackupRequestRepo } from './backup-request/adapter/impl/TypeormBackupRequestRepo';

import { TypeormBackupRepo } from './backup/adapter/impl/TypeormBackupRepo';

const moduleName = path.basename(module.filename);
const serviceName = 'accepted-consumer';
const featureName = 'store';

const buildWorker = (circuitBreakers: ICircuitBreakers) => {
	const logContext = { moduleName, functionName: 'buildWorker' };

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
					const delayMs = Math.min(
						appState.eventBus_bmqRetryDelayStartMs * 3 ** attemptsMade,
						appState.eventBus_bmqRetryDelayMaxMs
					);
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
	const logContext = { moduleName, functionName: 'startWorker' };

	logger.setBindings({
		serviceName,
		featureName,
		pm2ProcessId: appState.pm2_processId,
		pm2InstanceId: appState.pm2_instanceId,
	});

	const requiredStateMembers = [
		'eventBus_bmqRetryDelayStartMs',
		'eventBus_bmqRetryDelayMaxMs',
		'mssql_host',
		'mssql_port',
		'mssql_user',
		'mssql_password',
		'mssql_dbName',
		// no API so no auth checks needed
		'azureQueue_authMethod',
		'azureQueue_queueAccountUri',
		'eventBus_type',
	];
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

	// Worker requires BullMQ event bus type
	if (appState.eventBus_type.toLowerCase() !== 'bullmq') {
		logger.fatal({ ...logContext, eventBusType: appState.eventBus_type }, 'Event bus type is not BullMQ');
	}

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
		if (process.send) process.send('ready');
	} catch (e) {
		logger.error({ error: e, ...logContext }, `Caught error after worker.run()`);
		appAbortController.abort();
		await worker.close(); // gracefully shutdown the worker and release job locks
		await delay(5000);
		process.exit(1);
	}
};

startWorker();
