import fastify from 'fastify';

import { PrismaContext } from './common/infrastructure/database/prismaContext';

import { addBackupRequestRoutes } from './backup-request/infrastructure/fastifyRoutes';

export function buildApp(prismaCtx: PrismaContext, opts: any = {}) {
	const app = fastify(opts);

	addBackupRequestRoutes(app, prismaCtx);

	return app;
}
