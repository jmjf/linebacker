import { BaseError } from '../core/BaseError';

export class DatabaseError extends BaseError {
	constructor(messageOrErrorData: string | object, errorData?: object) {
		super(messageOrErrorData, errorData);
		this.name = 'DatabaseError';
	}

	cleanMessage(): string {
		const errorDataAny = this.errorData as any;
		return errorDataAny && errorDataAny.code ? errorDataAny.code.slice(1) : 'Database error';
	}
}

export class EventBusError extends BaseError {
	constructor(messageOrErrorData: string | object, errorData?: object) {
		super(messageOrErrorData, errorData);
		this.name = 'EventBusError';
	}

	cleanMessage(): string {
		const errorDataAny = this.errorData as any;
		return errorDataAny && errorDataAny.code ? errorDataAny.code.slice(1) : 'Event bus error';
	}
}

export class NotFoundError extends BaseError {
	constructor(messageOrErrorData: string | object, errorData?: object) {
		super(messageOrErrorData, errorData);
		this.name = 'NotFoundError';
	}
}

export class BackupJobServiceError extends BaseError {
	constructor(messageOrErrorData: string | object, errorData?: object) {
		super(messageOrErrorData, errorData);
		this.name = 'BackupJobServiceError';
	}
}

export class InvalidApiVersionError extends BaseError {
	constructor(messageOrErrorData: string | object, errorData?: object) {
		super(messageOrErrorData, errorData);
		this.name = 'InvalidApiVersionError';
	}
}

export class BadDataError extends BaseError {
	constructor(messageOrErrorData: string | object, errorData?: object) {
		super(messageOrErrorData, errorData);
		this.name = 'BadDataError';
	}
}

export class InterfaceAdapterError extends BaseError {
	constructor(messageOrErrorData: string | object, errorData?: object) {
		super(messageOrErrorData, errorData);
		this.name = 'InterfaceAdapterError';
	}
}

export class StatusJsonError extends BaseError {
	constructor(messageOrErrorData: string | object, errorData?: object) {
		super(messageOrErrorData, errorData);
		this.name = 'StatusJsonError';
	}
}
