import pino from 'pino';
import { isDev, isTest } from '../../common/utils/utils';

const pinoOptions = {
	name: 'linebacker',
	level: 'info',
	timestamp: pino.stdTimeFunctions.isoTime,
	// formatters: {
	// 	level(label: string, number: number) {
	// 		return { level: number, levelNumber: number, levelName: label };
	// 	},
	// },
};

if (isDev()) pinoOptions.level = 'debug';
if (isTest()) pinoOptions.level = 'fatal';

export const logger = pino(pinoOptions);
