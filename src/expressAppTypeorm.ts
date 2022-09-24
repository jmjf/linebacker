import express from 'express';
import { buildPinomor, buildTracerizer, buildJsonBodyErrorHandler } from './infrastructure/middleware/index';

import { addBackupRequestRoutes } from './backup-request/infrastructure/expressRoutesTypeorm';
import { TypeormContext } from './infrastructure/typeorm/typeormContext';
import { ICircuitBreakers } from './infrastructure/typeorm/buildCircuitBreakers.typeorm';
import { Logger } from 'pino';

export function buildApp(
	logger: Logger,
	typeormCtx: TypeormContext,
	circuitBreakers: ICircuitBreakers,
	abortSignal: AbortSignal
) {
	const reqTraceIdKey = 'tracerizerTraceId';
	const reqStartTimeKey = 'startHrTime';

	const app = express();

	// trace id (and start time)
	const tracerizer = buildTracerizer({ reqTraceIdKey });
	app.use(tracerizer);

	// request/response logging
	const pinomor = buildPinomor({
		log: logger.info,
		reqStartTimeKey,
		reqGetStartFromKey: reqTraceIdKey,
		reqTraceIdKey: reqTraceIdKey,
	});
	app.use(pinomor);

	// parse body as JSON
	app.use(express.json());

	const jsonBodyErrorHandler = buildJsonBodyErrorHandler({
		log: logger.error,
		reqTraceIdKey,
	});

	app.use(jsonBodyErrorHandler);

	addBackupRequestRoutes(app, typeormCtx, circuitBreakers, abortSignal);

	return app;
}
