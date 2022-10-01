function buildTracerizer(opts) {
	if (!opts.reqTraceIdKey) throw new Error('tracerizer requires opts.reqTraceIdKey');

	return function (req, res, next) {
		const start = process.hrtime.bigint();
		req[opts.reqTraceIdKey] = start.toString();
		next();
	};
}

module.exports = { buildTracerizer };
