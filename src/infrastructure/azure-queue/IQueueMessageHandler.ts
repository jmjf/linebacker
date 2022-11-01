export type QueueMessageHandlerResponse = {
   doesHandlerSucceed: boolean,
   opts?: any
}

export interface IQueueMessageHandler {
   processMessage(message: any, opts?: any): Promise<QueueMessageHandlerResponse>;
}