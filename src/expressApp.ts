import express from 'express';

import { addBackupRequestRoutes } from './backup-request/infrastructure/expressRoutes';
import { PrismaContext } from './common/infrastructure/database/prismaContext';

export function buildApp(prismaCtx: PrismaContext) {
	const app = express();
	app.use(express.json());

	addBackupRequestRoutes(app, prismaCtx);

	return app;
}
