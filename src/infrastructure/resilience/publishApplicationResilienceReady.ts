import { DomainEventBus } from '../../common/domain/DomainEventBus';
import { ApplicationResilienceReady } from './ApplicationResilienceReady';

export function publishApplicationResilienceReady(beforeTimestamp: Date) {
	DomainEventBus.publishToSubscribers(new ApplicationResilienceReady(beforeTimestamp));
}
