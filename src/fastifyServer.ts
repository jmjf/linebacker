import dotenv from 'dotenv';
import { logger } from './common/infrastructure/pinoLogger';

import { prismaCtx } from './common/infrastructure/database/prismaContext';
import { buildApp } from './fastifyApp';

const startServer = async () => {
	const logContext = 'linebacker | Fastify | startServer';

	logger.info(`${logContext} | get environment`);
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

	logger.info(`${logContext} | building server`);
	const server = buildApp(prismaCtx, {
		logger: logger,
	});

	logger.info(`${logContext} | starting server`);
	try {
		const address = await server.listen({ port: apiPort });
		logger.info(`${logContext} | listening on ${address}`);
	} catch (err) {
		server.log.error(err);
		process.exit(1);
	}
};

startServer();
