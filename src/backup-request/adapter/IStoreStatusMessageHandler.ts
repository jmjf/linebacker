import { Result } from '../../common/core/Result';

import * as AdapterErrors from '../../common/adapter/AdapterErrors';

export interface IStoreStatusMessageHandler {
	processMessage(message: unknown, opts?: unknown): Promise<Result<boolean, AdapterErrors.StatusJsonError>>;
}
