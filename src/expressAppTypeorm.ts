import express from 'express';
import { morganMiddleware } from './morgan.middleware';

import { addBackupRequestRoutes } from './backup-request/infrastructure/expressRoutesTypeorm';
import { TypeormContext } from './common/infrastructure/database/typeormContext';

export function buildApp(typeormCtx: TypeormContext) {
	const app = express();
	app.use(express.json());
	app.use(morganMiddleware);

	addBackupRequestRoutes(app, typeormCtx);

	return app;
}
