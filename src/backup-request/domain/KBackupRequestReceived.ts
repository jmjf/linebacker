import { IBusMessage } from '../../common/messaging/MessageBus';
import { BackupRequest } from './BackupRequest';

export interface KBackupRequestCreatedData {
	backupRequestId: string;
}

export class KBackupRequestCreated implements IBusMessage {
	private _messageTimestamp: Date;
	private _retryCount: number;
	private _messageData: KBackupRequestCreatedData;
	private _messageKey: string;

	constructor(backupRequest: BackupRequest) {
		this._messageTimestamp = new Date();
		this._retryCount = 0;
		this._messageData = {
			backupRequestId: backupRequest.backupRequestId.value,
		};
		this._messageKey = this._messageData.backupRequestId;
	}

	get messageKey() {
		return this._messageKey;
	}

	get messageData() {
		return this._messageData;
	}

	get messageDataString() {
		return JSON.stringify(this._messageData);
	}

	get topicName() {
		return 'backup-request-created';
	}

	get messageTimestamp() {
		return this._messageTimestamp;
	}

	get retryCount() {
		return this._retryCount;
	}

	incrementRetryCount() {
		this._retryCount++;
	}
}
