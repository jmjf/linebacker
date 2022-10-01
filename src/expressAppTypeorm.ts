import express from 'express';
import buildGetJwks from 'get-jwks';
import {
	buildPinomor,
	buildTracerizer,
	buildJsonBodyErrorHandler,
	buildAuthnerizer,
	buildAuthzerizer,
} from './infrastructure/middleware/index';

import { addBackupRequestRoutes } from './backup-request/infrastructure/expressRoutesTypeorm';
import { TypeormContext } from './infrastructure/typeorm/typeormContext';
import { ICircuitBreakers } from './infrastructure/typeorm/buildCircuitBreakers.typeorm';
import { Logger } from 'pino';
import { isTest } from './common/utils/utils';
import { buildFakeAuthNZ } from './test-helpers/index';
import { TypeormClientAuthorization } from './infrastructure/typeorm/entity/TypeormClientAuthorization';

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

	if (isTest()) {
		logger.warn('Detected test environment; using fake authentication/authorization');
		app.use(buildFakeAuthNZ());
	} else {
		const allowedIssuers = [process.env.AUTH_ISSUER as string];
		const getJwks = buildGetJwks({
			allowedDomains: allowedIssuers,
			ttl: 600 * 1000,
		});

		const authnerizer = buildAuthnerizer({
			allowedIssuers,
			logError: logger.error.bind(logger),
			reqTraceIdKey,
			fastjwtVerifierOptions: {
				cache: 1000,
				cacheTTL: 600 * 1000,
				requiredClaims: ['sub'],
			},
			buildGetPublicKey: (domain: string) => {
				return async function (token: { kid: string; alg: string }) {
					const key = await getJwks.getPublicKey({ kid: token.kid, alg: token.alg, domain });
					return key;
				};
			},
		});
		app.use(authnerizer);

		const authzerizer = buildAuthzerizer({
			cacheMax: 100,
			ttlMs: 30 * 1000,
			logError: logger.error.bind(logger),
			getAuthZFromDb: async (clientId: string) => {
				return typeormCtx.manager.findOne(TypeormClientAuthorization, {
					where: {
						clientIdentifier: clientId,
					},
				});
			},
		});
		app.use(authzerizer);
	}

	addBackupRequestRoutes(app, typeormCtx, circuitBreakers, abortSignal);

	return app;
}
