import { eventBus } from '../../common/infrastructure/event-bus/eventBus';
import { ApplicationResilienceReady } from './ApplicationResilienceReady.event';

export function publishApplicationResilienceReady(beforeTimestamp: Date) {
	eventBus.publishEventsBulk(new ApplicationResilienceReady(beforeTimestamp));
}
