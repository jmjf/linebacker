import express from 'express';
import { morganMiddleware } from './morgan.middleware';
import { handleBodyJsonErrors } from './infrastructure/middleware/handleBodyJsonError';

import { addBackupRequestRoutes } from './backup-request/infrastructure/expressRoutesPrisma';
import { PrismaContext } from './infrastructure/prismaContext';
import { ICircuitBreakers } from './infrastructure/buildCircuitBreakers.prisma';

export function buildApp(prismaCtx: PrismaContext, circuitBreakers: ICircuitBreakers) {
	const app = express();
	app.use(morganMiddleware);
	app.use(express.json());
	app.use(handleBodyJsonErrors());

	addBackupRequestRoutes(app, prismaCtx, circuitBreakers);

	return app;
}
