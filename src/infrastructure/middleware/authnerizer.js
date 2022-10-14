'use strict';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createDecoder, createVerifier } = require('fast-jwt');

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);

function buildAuthnerizer(opts) {
	const { allowedIssuers, fastjwtVerifierOptions, buildGetPublicKey, logError, reqTraceIdKey } = opts;
	if (!allowedIssuers || allowedIssuers.length === 0) throw Error('FATAL: Authnerizer requires opts.allowedIssuers');
	if (typeof buildGetPublicKey !== 'function')
		throw Error('FATAL: Authnerizer requires a function for opts.buildGetPublicKey');
	if (typeof logError !== 'function') throw Error('FATAL: Authnerizer requires a function for opts.logError');

	const jwtDecoder = createDecoder({ complete: true });
	const jwtVerifiers = new Map(
		allowedIssuers.map((iss) => [
			iss,
			createVerifier({
				...fastjwtVerifierOptions,
				key: buildGetPublicKey(iss),
			}),
		])
	);

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
			return next(get401Error('Cannot decode token', { authType, error: e }));
		}
		const issuer = decodedToken.payload.iss;

		if (!allowedIssuers.includes(issuer))
			return next(
				get401Error('Issuer not allowed', {
					decodedToken: { header: decodedToken.header, payload: decodedToken.payload },
				})
			);

		let verifiedToken = {};
		try {
			const verifyToken = jwtVerifiers.get(issuer);
			verifiedToken = await verifyToken(token);
		} catch (e) {
			return next(
				get401Error('Cannot verify token', {
					decodedToken: { header: decodedToken.header, payload: decodedToken.payload },
					error: e,
				})
			);
		}

		if (typeof verifiedToken !== 'object' || !verifiedToken.sub)
			return next(
				get401Error('Verified token not an object or missing members', {
					verifiedTokenType: typeof verifiedToken,
					verifiedToken,
				})
			);

		req.jwtPayload = verifiedToken;
		return next();
	};
}

module.exports = { buildAuthnerizer };
