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

	// parse body as JSON
	app.use(express.json());

	const jsonBodyErrorHandler = buildJsonBodyErrorHandler({
		log: logger.error.bind(logger),
		reqTraceIdKey,
	});
	app.use(jsonBodyErrorHandler);

	// trace id (and start time)
	const tracerizer = buildTracerizer({ reqTraceIdKey });
	app.use(tracerizer);

	// request/response logging
	const pinomor = buildPinomor({
		log: logger.info.bind(logger),
		reqStartTimeKey,
		reqGetStartFromKey: reqTraceIdKey,
		reqTraceIdKey: reqTraceIdKey,
	});
	app.use(pinomor);

	addBackupRequestRoutes(app, typeormCtx, circuitBreakers, abortSignal);

	return app;
}
