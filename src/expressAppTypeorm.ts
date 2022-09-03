import express from 'express';
import { buildPinomor } from './middleware/pinomor';
import { handleBodyJsonErrors } from './middleware/handleBodyJsonError';

import { addBackupRequestRoutes } from './backup-request/infrastructure/expressRoutesTypeorm';
import { TypeormContext } from './common/infrastructure/typeormContext';

export function buildApp(typeormCtx: TypeormContext) {
	const app = express();

	// request/response logging
	const pinomor = buildPinomor();
	app.use(pinomor);

	// parse body as JSON
	app.use(express.json());

	app.use(handleBodyJsonErrors());

	addBackupRequestRoutes(app, typeormCtx);

	return app;
}
