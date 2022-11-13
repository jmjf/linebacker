import { Result } from '../core/Result';
import { IBusMessage } from './MessageBus';

export interface IMessageBusAdapter {
	publish(message: IBusMessage): Promise<Result<IBusMessage, Error>>;
}
