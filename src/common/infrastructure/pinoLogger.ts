import pino from 'pino';
import { isDev } from '../../utils/utils';

const baseOptions = {
	name: 'linebacker',
	level: 'info',
	timestamp: pino.stdTimeFunctions.isoTime,
};

const pinoOptions = isDev()
	? {
			...baseOptions,
			level: 'debug',
			transport: {
				targets: [{ target: 'pino-pretty', level: 'info', options: {} }],
			},
	  }
	: {
			...baseOptions,
			formatters: {
				level(label: string, number: number) {
					return { logLevelNumber: number, logLevelText: label };
				},
			},
	  };

export const logger = pino(pinoOptions);
