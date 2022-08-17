import { BaseError } from '../core/BaseError';

export class DatabaseError extends BaseError {
	constructor(message: string) {
		super(message);
		this.name = 'DatabaseError';
	}

	cleanMessage(): string {
		let msg;
		try {
			msg = JSON.parse(this.callerMessage);
		} catch (e) {
			msg = { code: ' error' };
		}
		return msg.code.slice(1);
	}
}

export class NotFoundError extends BaseError {
	constructor(message: string) {
		super(message);
		this.name = 'NotFoundError';
	}
}

export class BackupJobServiceError extends BaseError {
	constructor(message: string) {
		super(message);
		this.name = 'BackupJobServiceError';
	}
}

export class InvalidApiVersionError extends BaseError {
	constructor(message: string) {
		super(message);
		this.name = 'InvalidApiVersionError';
	}
}

export class BadDataError extends BaseError {
	constructor(message: string) {
		super(message);
		this.name = 'BadDataError';
	}
}

export class SendQueueAdapterError extends BaseError {
	constructor(message: string) {
		super(message);
		this.name = 'SendQueueAdapterError';
	}
}
