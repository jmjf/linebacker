export type QueueMessageHandlerResponse = {
   doesHandlerSucceed: boolean,
   opts?: any
}

export type QueueMessageHandlerMessage = string;

export interface IQueueMessageHandler {
   processMessage(message: QueueMessageHandlerMessage, opts?: any): Promise<QueueMessageHandlerResponse>;
}