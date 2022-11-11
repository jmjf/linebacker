import { Result } from '../../common/core/Result';

import * as AdapterErrors from '../../common/adapter/AdapterErrors';

export interface AzureQueueReceiveResponse {
	messages: unknown[];
	startTime: Date;
	endTime: Date;
}

export interface AzureQueueDeleteResponse {
	responseStatus: number;
	startTime: Date;
	endTime: Date;
}

export interface IAzureQueueAdapter {
	get queueName(): string;

	receive(messageCount: number): Promise<Result<AzureQueueReceiveResponse, AdapterErrors.InterfaceAdapterError>>;

	delete(
		messageId: string,
		popReceipt: string
	): Promise<Result<AzureQueueDeleteResponse, AdapterErrors.InterfaceAdapterError>>;
}
