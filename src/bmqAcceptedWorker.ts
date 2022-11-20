import dotenv from 'dotenv';
import { logger } from './infrastructure/logging/pinoLogger';
logger.setBindings({
	service: 'accepted-consumer',
	feature: 'store',
	pm2ProcessId: process.env.pm_id,
	pm2InstanceId: process.env.PM2_INSTANCE_ID,
});

const logContext = { location: 'BullMQ Accepted Worker', function: 'pre-start' };

logger.info(logContext, 'getting environment');
if (!process.env.APP_ENV) {
	logger.error(logContext, 'APP_ENV is falsey');
	process.exit(1);
}

logger.info(logContext, `APP_ENV ${process.env.APP_ENV}`);
dotenv.config({ path: `./env/${process.env.APP_ENV}.env` });

import * as bullMq from 'bullmq';

import { delay } from './common/utils/utils';

import { typeormDataSource } from './infrastructure/typeorm/typeormDataSource';
import { typeormCtx } from './infrastructure/typeorm/typeormContext';
import { buildCircuitBreakers, ICircuitBreakers } from './infrastructure/typeorm/buildCircuitBreakers.typeorm';
import { bullMqConnection } from './infrastructure/bullmq/bullMqInfra';

import { BmqBackupRequestEventBus } from './backup-request/adapter/BullMqImpl/BmqBackupRequestEventBus';
import { TypeormBackupRequestRepo } from './backup-request/adapter/impl/TypeormBackupRequestRepo';
import { AcceptedBackupRequestConsumer } from './backup-request/adapter/BullMqImpl/AcceptedBackupRequestConsumer';
import { ReceiveBackupRequestUseCase } from './backup-request/use-cases/receive-backup-request/ReceiveBackupRequestUseCase';

const buildWorker = (circuitBreakers: ICircuitBreakers) => {
	const brRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreakers.dbCircuitBreaker);
	const bmqBus = new BmqBackupRequestEventBus(bullMq, bullMqConnection);
	const rcvUseCase = new ReceiveBackupRequestUseCase(brRepo, bmqBus);
	const acceptedConsumer = new AcceptedBackupRequestConsumer(rcvUseCase, 5);

	return new bullMq.Worker('backup-request-accepted', acceptedConsumer.consume.bind(acceptedConsumer), {
		autorun: false,
		connection: bullMqConnection,
		lockDuration: 30000,
	});
};

const startWorker = async () => {
	const logContext = { location: 'BullMQ Accepted Worker', function: 'startServer' };

	logger.info(logContext, 'initializing TypeORM data source');
	await typeormDataSource.initialize();

	logger.info(logContext, 'configuring circuit breakers');
	const appAbortController = new AbortController();
	const circuitBreakers = buildCircuitBreakers(appAbortController.signal);

	const worker = buildWorker(circuitBreakers);
	await delay(10000);
	logger.info('Starting worker');
	worker.run();
	logger.info('Worker running');
};

startWorker();
