import { createLogger, format, transports } from 'winston';

const logLevels = {
	error: 0,
	warn: 1,
	info: 2,
	http: 3,
	debug: 4,
	trace: 5,
};

const logLevel = ['dev', 'development'].includes(process.env.APP_ENV || 'none') ? 'debug' : 'info';

const logColors = {
	error: 'red',
	warn: 'yellow',
	info: 'green',
	http: 'magenta',
	debug: 'white',
	trace: 'gray',
};

const logFormat = format.combine(
	format.colorize({ colors: logColors, all: true }),
	format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
	format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
);

const logTransports = [new transports.Console()];

export const logger = createLogger({
	level: logLevel,
	levels: logLevels,
	format: logFormat,
	transports: logTransports,
});
