import express, { Request } from 'express';
import { buildPinomor, RequestWithHrTimeTraceId } from './pinomor';

import { addBackupRequestRoutes } from './backup-request/infrastructure/expressRoutesTypeorm';
import { TypeormContext } from './common/infrastructure/database/typeormContext';

export function buildApp(typeormCtx: TypeormContext) {
	const app = express();
	app.use(express.json());

	const pinomor = buildPinomor();
	app.use(pinomor);

	addBackupRequestRoutes(app, typeormCtx);

	return app;
}
