const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);

function buildJsonBodyErrorHandler(opts) {
	const { log, reqTraceIdKey } = opts;
	if (!log) throw new Error('jsonBodyErrorHandler requires opts.log');

	return function (err, req, res, next) {
		if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
			const traceIdLog = reqTraceIdKey ? { traceId: req[reqTraceIdKey] } : {};
			log({ ...traceIdLog, type: err.name, moduleName }, err.message);
			return res.status(400).send(`Invalid request body`); // Bad request
		}
		return next();
	};
}

module.exports = { buildJsonBodyErrorHandler };
