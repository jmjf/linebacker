import dotenv from 'dotenv';
import { logger } from './infrastructure/logging/pinoLogger';
logger.setBindings({
	service: 'api',
	feature: 'store',
	pm2ProcessId: process.env.pm_id,
	pm2InstanceId: process.env.PM2_INSTANCE_ID,
});

const logContext = { location: 'Express+TypeORM', function: 'pre-start' };

logger.info(logContext, 'getting environment');
if (!process.env.APP_ENV) {
	logger.error(logContext, 'APP_ENV is falsey');
	process.exit(1);
}

logger.info(logContext, `APP_ENV ${process.env.APP_ENV}`);
dotenv.config({ path: `./env/${process.env.APP_ENV}.env` });

import { typeormDataSource } from './infrastructure/typeorm/typeormDataSource';
import { typeormCtx } from './infrastructure/typeorm/typeormContext';
import { buildCircuitBreakers } from './infrastructure/typeorm/buildCircuitBreakers.typeorm';

import { buildApp } from './apiAppExpTypeorm';
import { publishApplicationResilienceReady } from './infrastructure/resilience/publishApplicationResilienceReady';
import { delay } from './common/utils/utils';
import { isTypeormConnected } from './infrastructure/typeorm/isTypeormConnected';

const startServer = async () => {
	const startTimestamp = new Date();
	const logContext = { location: 'Express+TypeORM', function: 'startServer' };

	if (!process.env.LINEBACKER_API_PORT || process.env.LINEBACKER_API_PORT.length === 0) {
		logger.error(logContext, 'LINEBACKER_API_PORT is falsey or empty');
		process.exit(1);
	}
	const apiPort = parseInt(process.env.LINEBACKER_API_PORT);
	logger.info(logContext, `apiPort ${apiPort}`);

	logger.info(logContext, 'initializing TypeORM data source');
	await typeormDataSource.initialize();

	logger.info(logContext, 'configuring circuit breakers');
	const appAbortController = new AbortController();
	const circuitBreakers = buildCircuitBreakers(appAbortController.signal);

	logger.info(logContext, 'building server');
	const zpageDependencies = {
		readyzDependencies: [
			{
				depName: circuitBreakers.dbCircuitBreaker.serviceName,
				checkDep: circuitBreakers.dbCircuitBreaker.isConnected.bind(circuitBreakers.dbCircuitBreaker),
			},
		],
		healthzDependencies: Object.values(circuitBreakers).map((cb) => {
			return { depName: cb.serviceName, checkDep: cb.getStatusSync.bind(cb) };
		}),
	};
	const app = buildApp(logger, typeormCtx, circuitBreakers, zpageDependencies, appAbortController.signal);
	app.disable('x-powered-by');

	logger.info(logContext, 'publishing ApplicationResilienceReady');
	publishApplicationResilienceReady(startTimestamp);
	await delay(2000);

	logger.info(logContext, 'starting server');
	try {
		app.listen({ port: apiPort });
		logger.info(logContext, `Server is running on port ${apiPort}`);
	} catch (err) {
		logger.error(logContext, `${err}`);
		appAbortController.abort();
		await delay(5000);
		process.exit(1);
	}
};

startServer();