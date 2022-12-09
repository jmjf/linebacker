import express from 'express';
import {
	buildPinomor,
	buildTracerizer,
	buildJsonBodyErrorHandler,
	buildAuthnerizer,
} from './infrastructure/middleware/index';

import { addBackupRequestRoutes } from './backup-request/infrastructure/expressRoutesPrisma';
import { PrismaContext } from './infrastructure/prisma/prismaContext';
import { ICircuitBreakers } from './infrastructure/prisma/buildCircuitBreakers.prisma';
import { Logger } from 'pino';
import { isTest } from './common/utils/utils';
import { buildFakeAuthNZ } from './test-helpers';
import buildGetJwks from 'get-jwks';
import { appState } from './infrastructure/app-state/appState';

export function buildApp(
	logger: Logger,
	prismaCtx: PrismaContext,
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
		const allowedIssuers = appState.auth_issuers;
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
	}

	addBackupRequestRoutes(app, prismaCtx, circuitBreakers, abortSignal);

	return app;
}
