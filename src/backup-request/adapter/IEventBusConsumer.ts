import { Result } from '../../common/core/Result';

export interface IEventBusConsumer {
	consume(job: unknown): unknown | Error;
}
