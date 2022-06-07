import { IQueueMessageHandler, QueueMessageHandlerMessage, QueueMessageHandlerResponse } from '../IQueueMessageHandler';

export class AzureQueueCreateBackupReplyMessageHandler implements IQueueMessageHandler {
   public async processMessage(message: QueueMessageHandlerMessage, opts?: any): Promise<QueueMessageHandlerResponse> {
      return { doesHandlerSucceed: true, opts: message };
   }
}