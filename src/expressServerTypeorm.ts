import dotenv from 'dotenv';
import { logger } from './infrastructure/pinoLogger';

const logContext = { location: 'Express+TypeORM', function: 'pre-start' };

logger.info(logContext, 'getting environment');
if (!process.env.APP_ENV) {
	logger.error(logContext, 'APP_ENV is falsey');
	process.exit(1);
}

logger.info(logContext, 'APP_ENV ${process.env.APP_ENV}');
dotenv.config({ path: `./env/${process.env.APP_ENV}.env` });

import { typeormDataSource } from './typeorm/typeormDataSource';
import { typeormCtx } from './infrastructure/typeormContext';
import { buildCircuitBreakers } from './infrastructure/buildCircuitBreakers.typeorm';

import { buildApp } from './expressAppTypeorm';

const startServer = async () => {
	const logContext = { location: 'Express+TypeORM', function: 'startServer' };

	if (!process.env.API_PORT || process.env.API_PORT.length === 0) {
		logger.error(logContext, 'API_PORT is falsey or empty');
		process.exit(1);
	}
	const apiPort = parseInt(process.env.API_PORT);
	logger.info(logContext, 'apiPort ${apiPort}');

	logger.info(logContext, 'initializing TypeORM data source');
	await typeormDataSource.initialize();

	logger.info(logContext, 'configuring circuit breakers');
	const appAbortController = new AbortController();
	const circuitBreakers = buildCircuitBreakers(appAbortController.signal);

	logger.info(logContext, 'building server');
	const server = buildApp(typeormCtx, circuitBreakers);

	logger.info(logContext, 'starting server');
	try {
		server.listen({ port: apiPort });
		logger.info(logContext, 'Server is running on port ${apiPort}');
	} catch (err) {
		logger.error(logContext, '${err}');
		appAbortController.abort();
		process.exit(1);
	}
};

startServer();