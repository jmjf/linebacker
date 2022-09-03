import { BaseError } from '../core/BaseError';

// Input values to a method are not valid
export class InputError extends BaseError {
	constructor(messageOrErrorData: string | object, errorData?: object) {
		super(messageOrErrorData, errorData);
		this.name = 'InputError';
	}
}

// Environment values are not valid
export class EnvironmentError extends BaseError {
	constructor(messageOrErrorData: string | object, errorData?: object) {
		super(messageOrErrorData, errorData);
		this.name = 'EnvironmentError';
	}
}

// Vendor SDK has an error
export class SDKError extends BaseError {
	constructor(messageOrErrorData: string | object, errorData?: object) {
		super(messageOrErrorData, errorData);
		this.name = 'SDKError';
	}
}
