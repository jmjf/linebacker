import express from 'express';
import { morganMiddleware } from './morgan.middleware';
import { handleBodyJsonErrors } from './middleware/handleBodyJsonError';

import { addBackupRequestRoutes } from './backup-request/infrastructure/expressRoutesPrisma';
import { PrismaContext } from './common/infrastructure/prismaContext';

export function buildApp(prismaCtx: PrismaContext) {
	const app = express();
	app.use(morganMiddleware);
	app.use(express.json());
	app.use(handleBodyJsonErrors());

	addBackupRequestRoutes(app, prismaCtx);

	return app;
}
