import { IBusMessage } from '../../common/messaging/MessageBus';
import { BackupRequest } from './BackupRequest';
import { BackupRequestStatusType } from './BackupRequestStatusType';
import { RequestTransportType } from './RequestTransportType';

export interface KBackupRequestAcceptedData {
	backupRequestId: string;
	backupJobId: string;
	dataDate: Date;
	preparedDataPathName: string;
	statusTypeCode: BackupRequestStatusType;
	transportTypeCode: RequestTransportType;
	getOnStartFlag: boolean;
	receivedTimestamp: Date;
	requesterId: string;
}

export class KBackupRequestAccepted implements IBusMessage {
	private _messageTimestamp: Date;
	private _retryCount: number;
	private _messageData: KBackupRequestAcceptedData;
	private _messageKey: string;

	constructor(backupRequest: BackupRequest) {
		this._messageTimestamp = new Date();
		this._retryCount = 0;
		this._messageData = {
			backupRequestId: backupRequest.backupRequestId.value,
			backupJobId: backupRequest.backupJobId.value,
			dataDate: backupRequest.dataDate,
			preparedDataPathName: backupRequest.preparedDataPathName,
			statusTypeCode: backupRequest.statusTypeCode,
			transportTypeCode: backupRequest.transportTypeCode,
			getOnStartFlag: backupRequest.getOnStartFlag,
			receivedTimestamp: backupRequest.receivedTimestamp,
			requesterId: backupRequest.requesterId,
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
		return 'backup-request-accepted';
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
