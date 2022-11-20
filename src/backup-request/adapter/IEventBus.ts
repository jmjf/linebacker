import { Result } from '../../common/core/Result';
import * as AdapterErrors from '../../common/adapter/AdapterErrors';
import { IEventBusEvent } from '../../infrastructure/event-bus/IEventBus';

export interface IEventBus {
	publish(event: IEventBusEvent): Promise<Result<IEventBusEvent, AdapterErrors.EventBusError>>;
}
