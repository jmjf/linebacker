import { IDomainEvent } from '../../common/domain/DomainEventBus';
import { UniqueIdentifier } from '../../common/domain/UniqueIdentifier';
import { BackupRequest } from './BackupRequest';

export class BackupRequestCreated implements IDomainEvent {
	public eventTimestamp: Date;
	public backupRequestId: UniqueIdentifier;

	constructor(backupRequest: BackupRequest) {
		this.eventTimestamp = new Date();
		this.backupRequestId = backupRequest.backupRequestId;
	}

	getAggregateId(): UniqueIdentifier {
		return this.backupRequestId;
	}
}
