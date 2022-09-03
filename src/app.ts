import fastify from 'fastify';

import { addBackupRequestRoutes } from './backup-request/infrastructure/fastifyRoutes';
import { PrismaContext } from './common/infrastructure/prismaContext';

export function buildApp(prismaCtx: PrismaContext, opts: any = {}) {
	const app = fastify(opts);

	addBackupRequestRoutes(app, prismaCtx);

	return app;
}
