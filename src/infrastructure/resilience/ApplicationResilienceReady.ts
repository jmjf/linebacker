import { IDomainEvent } from '../../common/domain/DomainEventBus';
import { UniqueIdentifier } from '../../common/domain/UniqueIdentifier';

export class ApplicationResilienceReady implements IDomainEvent {
	public eventTimestamp: Date;
	public beforeTimestamp: Date;

	constructor(beforeTimestamp: Date) {
		this.beforeTimestamp = beforeTimestamp;
	}

	getId(): UniqueIdentifier {
		// this event does not deal in ids
		return undefined as unknown as UniqueIdentifier;
	}
}
