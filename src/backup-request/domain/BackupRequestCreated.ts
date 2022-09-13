import { IDomainEvent } from '../../common/domain/DomainEventBus';
import { UniqueIdentifier } from '../../common/domain/UniqueIdentifier';
import { BackupRequest } from './BackupRequest';

export class BackupRequestCreated implements IDomainEvent {
	public eventTimestamp: Date;
	public retryCount: number;
	public backupRequestId: UniqueIdentifier;

	constructor(backupRequest: BackupRequest) {
		this.eventTimestamp = new Date();
		this.retryCount = 0;
		this.backupRequestId = backupRequest.id;
	}

	getAggregateId(): UniqueIdentifier {
		return this.backupRequestId;
	}
}
