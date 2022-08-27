import express from 'express';
import { morganMiddleware } from './morgan.middleware';

import { addBackupRequestRoutes } from './backup-request/infrastructure/expressRoutesPrisma';
import { PrismaContext } from './common/infrastructure/database/prismaContext';

export function buildApp(prismaCtx: PrismaContext) {
	const app = express();
	app.use(express.json());
	app.use(morganMiddleware);

	addBackupRequestRoutes(app, prismaCtx);

	return app;
}
