import fastify from 'fastify';

import { PrismaContext } from './infrastructure/prisma/prismaContext';

import { addBackupRequestRoutes } from './backup-request/infrastructure/fastifyRoutes';
import { ICircuitBreakers } from './infrastructure/buildCircuitBreakers.typeorm';

export function buildApp(prismaCtx: PrismaContext, circuitBreakers: ICircuitBreakers, opts: any = {}) {
	const app = fastify(opts);

	addBackupRequestRoutes(app, prismaCtx, circuitBreakers);

	return app;
}
