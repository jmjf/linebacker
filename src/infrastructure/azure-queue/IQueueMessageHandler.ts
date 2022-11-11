import { Result } from '../../common/core/Result';
import * as AdapterErrors from '../../common/adapter/AdapterErrors';

export type QueueMessageHandlerResponse = {
	doesHandlerSucceed: boolean;
	opts?: any;
};

export interface IQueueMessageHandler {
	processMessage(message: any, opts?: any): Promise<Result<boolean, AdapterErrors.StatusJsonError>>;
}
