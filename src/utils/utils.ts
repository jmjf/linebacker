import { isDate } from 'util/types';

export function dateOrUndefinedAsDate(date: any): Date {
	if (isDate(date) || (typeof date === 'string' && !isNaN(Date.parse(date)))) {
		return new Date(date);
	}
	return undefined as unknown as Date;
}

export function delay(ms: number): Promise<unknown> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isDev(): boolean {
	return (
		!process.env.APP_ENV ||
		(!!process.env.APP_ENV && ['dev', 'development'].includes(process.env.APP_ENV.toLowerCase()))
	);
}

export function isTest(): boolean {
	return process.env.JEST_WORKER_ID !== undefined;
}

export function toBase64(s: string): string {
	return Buffer.from(s).toString('base64');
}

export function fromBase64(s: string): string {
	return Buffer.from(s, 'base64').toString('ascii');
}
