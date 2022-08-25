import { BaseError } from '../core/BaseError';

// Input values to a method are not valid
export class InputError extends BaseError {
	constructor(message: string) {
		super(message);
		this.name = 'InputError';
	}
}

// Environment values are not valid
export class EnvironmentError extends BaseError {
	constructor(message: string) {
		super(message);
		this.name = 'EnvironmentError';
	}
}

// Vendor SDK has an error
export class SDKError extends BaseError {
	constructor(message: string) {
		super(message);
		this.name = 'SDKError';
	}
}
