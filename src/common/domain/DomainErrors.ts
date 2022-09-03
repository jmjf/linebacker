import { BaseError } from '../core/BaseError';

// this error is common to many things
export class PropsError extends BaseError {
	constructor(messageOrErrorData: string | object, errorData?: object) {
		super(messageOrErrorData, errorData);
		this.name = 'PropsError';
		this.code = 'BadData'; // code goes back to the caller; change to avoid a whiff of an information leak
	}
}
