import { NextFunction, Response } from 'express';

import { RequestWithHrTimeTraceId } from './pinomor';
import { logger } from '../common/infrastructure/pinoLogger';

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);

export function handleBodyJsonErrors() {
	return function (err: SyntaxError, req: RequestWithHrTimeTraceId, res: Response, next: NextFunction) {
		if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
			logger.error(
				{ traceId: req.hrTimeTraceId, type: err.name, message: err.message, moduleName },
				'Error parsing body JSON'
			);
			return res.status(400).send(`Invalid request body`); // Bad request
		}
		return next();
	};
}
