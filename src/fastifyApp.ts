import fastify from 'fastify';

import { PrismaContext } from './common/infrastructure/prismaContext';

import { addBackupRequestRoutes } from './backup-request/infrastructure/fastifyRoutes';

export function buildApp(prismaCtx: PrismaContext, opts: any = {}) {
	const app = fastify(opts);

	addBackupRequestRoutes(app, prismaCtx);

	return app;
}
