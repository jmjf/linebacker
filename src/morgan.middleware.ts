import morgan from 'morgan';

import { logger } from './common/infrastructure/winstonLogger';

const stream = {
	write: (message: unknown) => logger.http(message),
};

const skip = () => {
	return !['dev', 'development'].includes(process.env.APP_ENV || 'none');
};

export const morganMiddleware = morgan(':remote-addr :method :url :status :res[content-length] - :response-time ms', {
	stream,
	skip,
});
