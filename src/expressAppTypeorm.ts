import express from 'express';
import { buildPinomor } from './infrastructure/middleware/pinomor';
import { handleBodyJsonErrors } from './infrastructure/middleware/handleBodyJsonError';

import { addBackupRequestRoutes } from './backup-request/infrastructure/expressRoutesTypeorm';
import { TypeormContext } from './infrastructure/typeorm/typeormContext';
import { ICircuitBreakers } from './infrastructure/typeorm/buildCircuitBreakers.typeorm';

export function buildApp(typeormCtx: TypeormContext, circuitBreakers: ICircuitBreakers, abortSignal: AbortSignal) {
	const app = express();

	// request/response logging
	const pinomor = buildPinomor();
	app.use(pinomor);

	// parse body as JSON
	app.use(express.json());

	app.use(handleBodyJsonErrors());

	addBackupRequestRoutes(app, typeormCtx, circuitBreakers, abortSignal);

	return app;
}
