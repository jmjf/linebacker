'use strict';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createDecoder, createVerifier } = require('fast-jwt');

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);

function buildAuthnerizer(opts) {
	const { allowedIssuers, fastjwtVerifierOptions, getPublicKey, logError, reqTraceIdKey } = opts;
	if (!allowedIssuers || allowedIssuers.length === 0) throw Error('FATAL: Authnerizer requires opts.allowedIssuers');
	if (typeof getPublicKey !== 'function') throw Error('FATAL: Authnerizer requires a function for opts.getPublicKey');
	if (typeof logError !== 'function') throw Error('FATAL: Authnerizer requires a function for opts.logError');

	const jwtDecoder = createDecoder({ complete: true });
	const jwtVerifiers = new Map(allowedIssuers.map((iss) => [iss]));

	return async function (req, res, next) {
		function get401Error(msg, errorData) {
			let traceId = {};
			if (reqTraceIdKey) traceId = { traceId: req[reqTraceIdKey] };
			logError({ ...traceId, ...errorData, moduleName }, msg);
			const err = new Error('Unauthorized');
			err.status = 401;
			return err;
		}

		const authHeader = req.get('Authorization');
		if (!authHeader) return next(get401Error('Missing Authorization header'));

		// get the token
		const [authType, token] = authHeader.split(' ');

		if (!authType || authType.toLowerCase() !== 'bearer' || !token)
			return next(get401Error('Invalid authorization header', { authType, hasToken: !!token }));

		// token is a bearer token so we can use it
		let decodedToken = {};
		try {
			decodedToken = jwtDecoder(token);
		} catch (e) {
			return next(get401Error('Cannot decode token', { authType, token, error: e }));
		}

		if (!allowedIssuers.includes(decodedToken.payload.iss))
			return next(get401Error('Issuer not allowed', { decodedToken }));

		let verifiedToken = {};
		try {
			const verifyToken = createVerifier({ ...fastjwtVerifierOptions, complete: true, key: getPublicKey });
			verifiedToken = await verifyToken(token);
		} catch (e) {
			return next(get401Error('Cannot verify token', { decodedToken, error: e }));
		}

		if (typeof verifiedToken !== 'object' || !verifiedToken.header || !verifiedToken.payload)
			return next(
				get401Error('Verified token not an object or missing members', {
					verifiedTokenType: typeof verifiedToken,
					verifiedToken,
				})
			);

		req.jwtHeader = verifiedToken.header;
		req.jwtPayload = verifiedToken.payload;
		return next();
	};
}

module.exports = { buildAuthnerizer };
