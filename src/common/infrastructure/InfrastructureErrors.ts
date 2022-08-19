import { BaseError } from '../core/BaseError';

export class InputError extends BaseError {
	constructor(message: string) {
		super(message);
		this.name = 'InputError';
	}
}

export class EnvironmentError extends BaseError {
	constructor(message: string) {
		super(message);
		this.name = 'EnvironmentError';
	}
}
