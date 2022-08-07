import dotenv from 'dotenv';

import { PrismaClient } from '@prisma/client';

import { PrismaContext } from './common/infrastructure/database/prismaContext';
import { buildApp } from '../src/fastifyApp';

console.log('linebacker | getting environment');
if (!process.env.APP_ENV) {
	console.error(`main | APP_ENV is falsey`);
	process.exit(1);
}

console.log(`linebacker | APP_ENV ${process.env.APP_ENV}`);
dotenv.config({ path: `./env/${process.env.APP_ENV}.env` });

if (!process.env.API_PORT || process.env.API_PORT.length === 0) {
	console.log('linebacker | API_PORT is falsey or empty');
	process.exit(1);
}
const apiPort = parseInt(process.env.API_PORT);
console.log(`linebacker | apiPort ${apiPort}`);

console.log('linebacker | creating Prisma client');
const prismaCtx: PrismaContext = {
	prisma: new PrismaClient(),
};
console.log('linebacker | connecting Prisma client');
await prismaCtx.prisma.$connect();

console.log('linebacker | building server');
const server = buildApp(prismaCtx, {
	logger: {
		level: 'debug',
		transport: {
			target: 'pino-pretty',
		},
	},
});

const start = async () => {
	console.log('linebacker | starting server');
	try {
		const address = await server.listen({ port: apiPort });
		console.log(`linebacker | listening on ${address}`);
	} catch (err) {
		server.log.error(err);
		process.exit(1);
	}
};

start();
