import path from 'node:path';
import { logger } from '../../../infrastructure/logging/pinoLogger';
import { ok, Result } from '../../core/Result';
import { EventBusError } from '../InfrastructureErrors';
import { EventBusHandler, IEventBus, EventBusEvent } from './IEventBus';

const moduleName = path.basename(module.filename);

export class MemoryEventBus implements IEventBus {
    private _eventHandlers: Map<string, EventBusHandler[]>;

    constructor() {
        this._eventHandlers = new Map<string, EventBusHandler[]>;
    }

    async publishEvent(event: EventBusEvent<unknown>): Promise<Result<EventBusEvent<unknown>, EventBusError>> {
        const functionName = 'publishEvent';
        const eventName: string = event.constructor.name;

        const handlers = this._eventHandlers.get(eventName);
        if (handlers) {
            for (const handler of handlers) {
                logger.trace({eventName, handlerName: handler.name, moduleName, functionName}, 'Publish event');
                handler(event);
            }
        }
        return ok(event);
    }

    async publishEventsBulk(events: EventBusEvent<unknown>[]): Promise<Result<EventBusEvent<unknown>[], EventBusError>> {
		for (const ev of events) {
			await this.publishEvent(ev);
		};
		// publishEvent returns the event we passed it if ok, so if nothing failed, can just return the events passed
		return ok(events);
    }

    subscribe(eventName: string, handler: (event: EventBusEvent<unknown>) => void): void {
        // either the array for the event's handlers or an empty array
        const eventHandlers = this._eventHandlers.get(eventName) || [];
        // only add handler if it isn't already registered
        if (!eventHandlers.find(h => h === handler)) {
            eventHandlers.push(handler);
            this._eventHandlers.set(eventName, eventHandlers);
        }
    }

    clearHandlers() {
        this._eventHandlers.clear();
    }
}
