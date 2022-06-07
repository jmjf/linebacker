import { AzureQueueCreateBackupReplyMessageHandler } from './AzureQueueCreateBackupReplyMessageHandler';


describe('AzureQueueCreateBackupReplyMessageHandler', () => {
   test('smoke test', async () => {
      // Arrange
      const messageHandler = new AzureQueueCreateBackupReplyMessageHandler();
      const message = 'test';

      // Act
      const result = await messageHandler.processMessage(message);

      // Assert
      expect(result.doesHandlerSucceed).toBe(true);
      expect(result.opts).toBe(message);
   });
});