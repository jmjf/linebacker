import pino from 'pino';
import { isDev, isTest } from '../../common/utils/utils';

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
				targets: [{ target: 'pino-pretty', level: 'debug', options: {} }],
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
if (isTest()) pinoOptions.level = 'fatal';

export const logger = pino(pinoOptions);
