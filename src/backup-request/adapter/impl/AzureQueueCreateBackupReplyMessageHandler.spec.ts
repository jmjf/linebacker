import { BackupResultTypeValues } from '../../domain/BackupResultType';
import { AzureQueueCreateBackupReplyMessageHandler, IAzureQueueCreateBackupReplyMessage } from './AzureQueueCreateBackupReplyMessageHandler';

describe('AzureQueueCreateBackupReplyMessageHandler', () => {
   const baseMessage: IAzureQueueCreateBackupReplyMessage = {
      apiVersion: '2022-05-30',
      backupRequestId: 'replyBackupRequestId',
      storagePathName: 'reply/storage/path/name',
      resultTypeCode: BackupResultTypeValues.Succeeded,
      backupByteCount: 1000000,
      copyStartTimestamp: '2022-05-06T00:20:03.111Z',
      copyEndTimestamp: '2022-05-06T00:32:23.888Z'
   };

   test('when the message is not JSON, it returns not successful', async () => {
      // Arrange
      const messageHandler = new AzureQueueCreateBackupReplyMessageHandler();
      const message = 'not json';

      // Act
      const result = await messageHandler.processMessage(message);

      // Assert
      expect(result.doesHandlerSucceed).toBe(false);
   });

   test('when apiVersion is invalid, it returns not successful', async () => {
      // Arrange
      const messageHandler = new AzureQueueCreateBackupReplyMessageHandler();
      const message = JSON.stringify({ ...baseMessage, apiVersion: '2022-06-07' });

      // Act
      const result = await messageHandler.processMessage(message);

      // Assert
      expect(result.doesHandlerSucceed).toBe(false);
      expect(result.opts?.error).toBe('Invalid apiVersion');
   });


});