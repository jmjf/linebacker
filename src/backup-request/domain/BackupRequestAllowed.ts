import { IDomainEvent } from '../../common/domain/DomainEventBus';
import { UniqueIdentifier } from '../../common/domain/UniqueIdentifier';

export class BackupRequestAllowed implements IDomainEvent {
	public eventTimestamp: Date;
	public retryCount: number;
	public id: UniqueIdentifier;

	constructor(id: UniqueIdentifier) {
		this.eventTimestamp = new Date();
		this.retryCount = 0;
		this.id = id;
	}

	getId(): UniqueIdentifier {
		return this.id;
	}
}
