import { EventBusEvent } from '../../common/infrastructure/event-bus/IEventBus';
import { BackupRequest } from './BackupRequest';

export interface BackupRequestReceivedEventData {
	// After received, all consumers must get data from persisted data
	// so we only need the request id so they can find it
	event: {
		backupRequestId: string;
	};
}

export class BackupRequestReceived extends EventBusEvent<BackupRequestReceivedEventData> {

	constructor(backupRequest: BackupRequest) {
		super();
		this._eventData = {
			connectFailureCount: 0,
			retryCount: 0,
			eventType: this.constructor.name,
			event: {
				backupRequestId: backupRequest.backupRequestId.value,
			},
		};
		this._eventKey = this._eventData.event.backupRequestId;
	}
}
