import { Result } from '../../common/core/Result';

export interface IQueueConsumer {
	consume(job: unknown): unknown | Error;
}
