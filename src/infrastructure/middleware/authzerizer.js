'use strict';

/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('node:path');
const LRUCache = require('mnemonist/lru-cache-with-delete');

const moduleName = path.basename(module.filename);

function buildAuthzerizer(opts) {
	const { logError, getAuthZFromDb, reqTraceIdKey } = opts;
	const cacheMax = opts.cacheMax ? opts.cacheMax : 1000;
	const ttlMs = opts.ttlMs ? opts.ttlMs : 3600 * 1000;

	if (typeof getAuthZFromDb !== 'function')
		throw Error('FATAL: Authzerizer requires a function for opts.getAuthZFromDb');
	if (typeof logError !== 'function') throw Error('FATAL: Authzerizer requires a function for opts.logError');

	const authZCache = new LRUCache(cacheMax);

	return async function (req, res, next) {
		function get403Error(msg, errorData) {
			let traceId = {};
			if (reqTraceIdKey) traceId = { traceId: req[reqTraceIdKey] };
			logError({ ...traceId, ...errorData, moduleName }, msg);
			const err = new Error('Forbidden');
			err.status = 403;
			return err;
		}

		//console.log('authz req', req);

		if (!req.jwtPayload || typeof req.jwtPayload.sub !== 'string' || req.jwtPayload.sub.length === 0)
			return next(get403Error('Missing client id', req.jwtPayload || { error: 'jwtPayload undefined' }));

		const jwtSub = req.jwtPayload.sub;
		const now = new Date().valueOf();

		let authZResult = authZCache.get(jwtSub);

		if (authZResult && authZResult.expiresTime < now) {
			authZCache.delete(jwtSub);
			authZResult = undefined;
		}

		if (authZResult === undefined) {
			try {
				const dbAuthZResult = await getAuthZFromDb(jwtSub);
				if (dbAuthZResult === null) return next(get403Error('AuthZ not found in database', req.jwtPayload));
				authZResult = {
					expiresTime: now + ttlMs,
					clientScopes: dbAuthZResult.clientScopes.split('|'),
				};
				authZCache.set(jwtSub, authZResult);
			} catch (e) {
				return next(get403Error('AuthZ database read failure', e));
			}
		}

		req.clientScopes = authZResult.clientScopes;
		next();
	};
}

module.exports = { buildAuthzerizer };
