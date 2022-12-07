import pino from 'pino';
import { isTest } from '../../common/utils/utils';

const pinoOptions = {
	name: 'linebacker',
	level: process.env.LOG_LEVEL || 'info',
	timestamp: pino.stdTimeFunctions.isoTime,
	// formatters: {
	// 	level(label: string, number: number) {
	// 		return { level: number, levelNumber: number, levelName: label };
	// 	},
	// },
};

if (isTest()) pinoOptions.level = 'fatal';

export const logger = pino(pinoOptions);
