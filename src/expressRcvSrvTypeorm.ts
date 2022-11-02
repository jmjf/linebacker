import dotenv from 'dotenv';
import { logger } from './infrastructure/logging/pinoLogger';

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

import { buildApp } from './expressRcvAppTypeorm';
import { delay } from './common/utils/utils';

const startServer = async () => {
	const logContext = { location: 'Express+TypeORM Receive', function: 'startServer' };

	if (!process.env.API_PORT || process.env.API_PORT.length === 0) {
		logger.error(logContext, 'API_PORT is falsey or empty');
		process.exit(1);
	}
	const apiPort = parseInt(process.env.API_PORT) + 1;
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
