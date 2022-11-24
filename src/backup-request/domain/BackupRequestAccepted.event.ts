import { EventBusEvent } from '../../common/infrastructure/event-bus/IEventBus';
import { BackupRequest } from './BackupRequest';

import { BackupRequestStatusType } from './BackupRequestStatusType';
import { RequestTransportType } from './RequestTransportType';

export interface BackupRequestAcceptedEventData {
	event: {
		backupRequestId: string;
		backupJobId: string;
		dataDate: Date;
		preparedDataPathName: string;
		statusTypeCode: BackupRequestStatusType;
		transportTypeCode: RequestTransportType;
		getOnStartFlag: boolean;
		receivedTimestamp: Date;
		requesterId: string;
	};
}

export class BackupRequestAccepted extends EventBusEvent<BackupRequestAcceptedEventData> {

	constructor(backupRequest: BackupRequest) {
		super();
		this._eventData = {
			connectFailureCount: 0,
			retryCount: 0,
			eventType: this.constructor.name,
			event: {
				backupRequestId: backupRequest.backupRequestId.value,
				backupJobId: backupRequest.backupJobId.value,
				dataDate: backupRequest.dataDate,
				preparedDataPathName: backupRequest.preparedDataPathName,
				statusTypeCode: backupRequest.statusTypeCode,
				transportTypeCode: backupRequest.transportTypeCode,
				getOnStartFlag: backupRequest.getOnStartFlag,
				receivedTimestamp: backupRequest.receivedTimestamp,
				requesterId: backupRequest.requesterId,
			},
		};
		this._eventKey = this._eventData.event.backupRequestId;
	}
}
