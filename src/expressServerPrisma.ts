import dotenv from 'dotenv';

import { prismaCtx } from './infrastructure/prisma/prismaContext';
import { logger } from './infrastructure/winstonLogger';
import { buildApp } from './expressAppPrisma';
import { buildCircuitBreakers } from './infrastructure/buildCircuitBreakers.prisma';

const startServer = async () => {
	const logContext = 'linebacker | Express | startServer';

	logger.info(`${logContext} | getting environment`);
	if (!process.env.APP_ENV) {
		logger.error(`${logContext} | APP_ENV is falsey`);
		process.exit(1);
	}

	logger.info(`${logContext} | APP_ENV ${process.env.APP_ENV}`);
	dotenv.config({ path: `./env/${process.env.APP_ENV}.env` });
	if (!process.env.API_PORT || process.env.API_PORT.length === 0) {
		logger.error(`${logContext} | API_PORT is falsey or empty`);
		process.exit(1);
	}
	const apiPort = parseInt(process.env.API_PORT);
	logger.info(`${logContext} | apiPort ${apiPort}`);

	logger.info(`${logContext} | connecting Prisma client`);
	await prismaCtx.prisma.$connect();

	logger.info(logContext, 'configuring circuit breakers');
	const appAbortController = new AbortController();
	const circuitBreakers = buildCircuitBreakers(appAbortController.signal);

	logger.info(`${logContext} | building server`);
	const server = buildApp(prismaCtx, circuitBreakers);

	logger.info(`${logContext} | starting server`);
	try {
		server.listen({ port: apiPort });
		logger.info(`${logContext} | Server is running on port ${apiPort}`);
	} catch (err) {
		logger.error(`${logContext} | ${err}`);
		process.exit(1);
	}
};

startServer();
