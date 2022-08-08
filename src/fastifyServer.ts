import dotenv from 'dotenv';

import { prismaCtx } from './common/infrastructure/database/prismaContext';
import { buildApp } from './fastifyApp';

const startServer = async () => {
	const logContext = 'linebacker | startServer';

	console.log(`${logContext} | getting environment`);
	if (!process.env.APP_ENV) {
		console.error(`main | APP_ENV is falsey`);
		process.exit(1);
	}

	console.log(`${logContext} | APP_ENV ${process.env.APP_ENV}`);
	dotenv.config({ path: `./env/${process.env.APP_ENV}.env` });
	if (!process.env.API_PORT || process.env.API_PORT.length === 0) {
		console.log(`${logContext} | API_PORT is falsey or empty`);
		process.exit(1);
	}
	const apiPort = parseInt(process.env.API_PORT);
	console.log(`${logContext} | apiPort ${apiPort}`);

	console.log(`${logContext} | connecting Prisma client`);
	await prismaCtx.prisma.$connect();

	console.log(`${logContext} | building server`);
	const server = buildApp(prismaCtx, {
		logger: {
			level: 'debug',
			transport: {
				target: 'pino-pretty',
			},
		},
	});

	console.log(`${logContext} | starting server`);
	try {
		const address = await server.listen({ port: apiPort });
		console.log(`${logContext} | listening on ${address}`);
	} catch (err) {
		server.log.error(err);
		process.exit(1);
	}
};

startServer();
