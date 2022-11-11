import dotenv from 'dotenv';
import { logger } from './infrastructure/logging/pinoLogger';
logger.setBindings({
	service: 'queue-watcher',
	feature: 'store',
	pm2ProcessId: process.env.pm_id,
	pm2InstanceId: process.env.PM2_INSTANCE_ID,
});

const logContext = { location: 'Express+TypeORM Receive', function: 'pre-start' };

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

import { buildApp } from './rcvAppExpTypeorm';
import { delay } from './common/utils/utils';

const startServer = async () => {
	const logContext = { location: 'Express+TypeORM Receive', function: 'startServer' };

	if (!process.env.BRQW_ZPAGES_PORT || process.env.BRQW_ZPAGES_PORT.length === 0) {
		logger.error(logContext, 'BRQW_ZPAGES_PORT is falsey or empty');
		process.exit(1);
	}
	const zpagesPort = parseInt(process.env.BRQW_ZPAGES_PORT);
	logger.info(logContext, `zpagesPort ${zpagesPort}`);

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

	logger.info(logContext, 'starting server');
	try {
		app.listen({ port: zpagesPort });
		logger.info(logContext, `Server is running on port ${zpagesPort}`);
	} catch (err) {
		logger.error(logContext, `${err}`);
		appAbortController.abort();
		await delay(5000);
		process.exit(1);
	}
};

startServer();