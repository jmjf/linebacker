import { BaseError } from '../core/BaseError';

export class UnexpectedError extends BaseError {
	constructor(messageOrErrorData: string | object, errorData?: object) {
		super(messageOrErrorData, errorData);
		this.name = 'UnexpectedError';
	}
}

export class BackupRequestStatusError extends BaseError {
	constructor(messageOrErrorData: string | object, errorData?: object) {
		super(messageOrErrorData, errorData);
		this.name = 'BackupRequestStatusError';
	}
}

export class SendToInterfaceError extends BaseError {
	constructor(messageOrErrorData: string | object, errorData?: object) {
		super(messageOrErrorData, errorData);
		this.name = 'SendToInterfaceError';
	}
}
