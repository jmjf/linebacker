import { NextFunction, Request, Response } from 'express';
import { logger } from '../common/infrastructure/pinoLogger';

export interface RequestWithHrTimeTraceId extends Request {
	hrTimeTraceId?: string;
}

export function buildPinomor() {
	return function (req: RequestWithHrTimeTraceId, res: Response, next: NextFunction) {
		const start = process.hrtime.bigint();
		req.hrTimeTraceId = start.toString();

		logger.info(
			{ traceId: req.hrTimeTraceId, requestMethod: req.method, requestUrl: req.originalUrl, requesterIp: req.ip },
			'Received'
		);

		res.on('finish', () => {
			// hrtime -> nanoseconds; ns / 1e6 -> ms
			const resMs = Math.round(parseInt((process.hrtime.bigint() - start).toString()) / 1e6);
			logger.info(
				{
					traceId: req.hrTimeTraceId,
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
