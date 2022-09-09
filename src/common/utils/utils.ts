import { isDate } from 'util/types';
import { setTimeout as setTimeoutPromise } from 'timers/promises';

export type Dictionary = { [index: string]: any };

export function dateOrUndefinedAsDate(date: any): Date {
	if (isDate(date) || (typeof date === 'string' && !isNaN(Date.parse(date)))) {
		return new Date(date);
	}
	return undefined as unknown as Date;
}

// if delay gets
export function delay(ms: number, signal?: AbortSignal): Promise<string> {
	if (signal && typeof signal === 'object' && signal.constructor.name === 'AbortSignal') {
		return setTimeoutPromise(ms, 'ok', { signal }).catch((e) => {
			if (e.name === 'AbortError') return 'AbortError';
			// else
			throw e;
		});
	} else {
		return new Promise((resolve) =>
			setTimeout(() => {
				resolve('ok');
			}, ms)
		);
	}
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

export function safeJsonParse(s: string): object {
	try {
		return JSON.parse(s);
	} catch (e) {
		return { unparseableJson: s };
	}
}
