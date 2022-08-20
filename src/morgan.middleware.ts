import morgan from 'morgan';

import { logger } from './common/infrastructure/logger';

const stream = {
	write: (message: any) => logger.http(message),
};

const skip = () => {
	return !['dev', 'development'].includes(process.env.APP_ENV || 'none');
};

export const morganMiddleware = morgan(
	':remote-addr :method :url :status :res[content-length] - :response-time ms',
	{ stream, skip }
);