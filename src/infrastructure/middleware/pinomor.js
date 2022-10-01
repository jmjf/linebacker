function buildPinomor(opts) {
	const { log, reqStartTimeKey, reqTraceIdKey, reqGetStartFromKey } = opts;
	if (!log) throw new Error('FATAL: pinomor requires opts.logger');
	if (!reqStartTimeKey) throw new Error('FATAL: pinomor requires opts.reqStartTimeKey');

	return function (req, res, next) {
		const traceIdLog = reqTraceIdKey ? { traceId: req[reqTraceIdKey] } : {};
		req[reqStartTimeKey] =
			reqGetStartFromKey && req[reqGetStartFromKey] ? BigInt(req[reqGetStartFromKey]) : process.hrtime.bigint();

		log({ ...traceIdLog, requestMethod: req.method, requestUrl: req.originalUrl, requesterIp: req.ip }, 'Received');

		res.on('finish', () => {
			// hrtime -> nanoseconds; ns / 1e6 -> ms
			const resMs = Math.round(parseInt((process.hrtime.bigint() - req[reqStartTimeKey]).toString()) / 1e6);
			log(
				{
					...traceIdLog,
					requestMethod: req.method,
					requestUrl: req.originalUrl,
					requesterIp: req.ip,
					statusCode: res.statusCode,
					contentLength: res.getHeader('content-length'),
					responseTimeMs: resMs.toString(),
				},
				'Responded'
			);
		});

		next();
	};
}

module.exports = { buildPinomor };
