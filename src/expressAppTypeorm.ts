import express from 'express';
import { buildPinomor } from './pinomor';

import { addBackupRequestRoutes } from './backup-request/infrastructure/expressRoutesTypeorm';
import { TypeormContext } from './common/infrastructure/typeormContext';

export function buildApp(typeormCtx: TypeormContext) {
	const app = express();
	app.use(express.json());

	const pinomor = buildPinomor();
	app.use(pinomor);

	addBackupRequestRoutes(app, typeormCtx);

	return app;
}
