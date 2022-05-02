import { SendRequestToInterfaceUseCase } from './SendRequestToInterfaceUseCase';
import { SendRequestToInterfaceDTO } from './SendRequestToInterfaceDTO';
import { backupInterfaceAdapterFactory } from '../../test-utils/backupInterfaceAdapterFactory';
import { backupRequestRepoFactory } from '../../test-utils/backupRequestRepoFactory';
import { BackupRequest, IBackupRequestProps } from '../../domain/BackupRequest';

describe('Send Request To Interface Use Case', () => {
   const baseDto = {
      requestId: 'test'
   } as SendRequestToInterfaceDTO;

   const backupRequestProps = {
      backupJobId: 'job', // set in test Arrange phase to support logging if needed
      dataDate: new Date(),
      preparedDataPathName: 'path',
      getOnStartFlag: true,
      transportTypeCode: 'HTTP',
      statusTypeCode: 'Allowed',
      receivedTimestamp: new Date(),
      checkedTimestamp: new Date()      
   } as IBackupRequestProps;

   test('when request is Allowed, it returns a BackupRequest in Sent status', async () => {
      // Arrange
      const startTimestamp = new Date();
      const resultBackupRequest = BackupRequest.create(
         {
            ...backupRequestProps,
            backupJobId: 'request Allowed'
         }).getValue();
      const repo = backupRequestRepoFactory({getByIdResult: resultBackupRequest});
      const adapter = backupInterfaceAdapterFactory({sendMessageResult: true});
      const useCase = new SendRequestToInterfaceUseCase({backupRequestRepo: repo, backupInterfaceAdapater: adapter});
      const dto = { ...baseDto };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isRight()).toBe(true);
      expect(result.value.getValue().statusTypeCode).toBe('Sent');
      expect(result.value.getValue().sentToInterfaceTimestamp.valueOf()).toBeGreaterThan(startTimestamp.valueOf());
   });

   test('when request is Sent, it returns a BackupRequest in Sent status with sent timestamp unchanged', async () => {
      // Arrange
      const resultBackupRequest = BackupRequest.create(
         {
            ...backupRequestProps,
            backupJobId: 'request is Sent',
            statusTypeCode: 'Sent',
            sentToInterfaceTimestamp: new Date()    
         }
      ).getValue();
      const sentTimestamp = new Date(resultBackupRequest.sentToInterfaceTimestamp); // ensure we have a separate instance
      const repo = backupRequestRepoFactory({getByIdResult: resultBackupRequest});
      const adapter = backupInterfaceAdapterFactory({sendMessageResult: true});
      const useCase = new SendRequestToInterfaceUseCase({backupRequestRepo: repo, backupInterfaceAdapater: adapter});
      const dto = { ...baseDto };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isRight()).toBe(true);
      expect(result.value.getValue().statusTypeCode).toBe('Sent');
      expect(result.value.getValue().sentToInterfaceTimestamp.valueOf()).toBe(sentTimestamp.valueOf());
   });

   test('when request does not exist, it returns failure', async () => {
      // Arrange
      const repo = backupRequestRepoFactory();
      const adapter = backupInterfaceAdapterFactory({sendMessageResult: true});
      const useCase = new SendRequestToInterfaceUseCase({backupRequestRepo: repo, backupInterfaceAdapater: adapter});
      const dto = { ...baseDto };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isLeft()).toBe(true);
   });

   test('when request is in NotAllowed status, it returns failure', async () => {
      // Arrange
      const resultBackupRequest = BackupRequest.create(
         {
            ...backupRequestProps,
            backupJobId: 'request NotAllowed',
            statusTypeCode: 'NotAllowed'
         }
      ).getValue();
      const repo = backupRequestRepoFactory({getByIdResult: resultBackupRequest});
      const adapter = backupInterfaceAdapterFactory({sendMessageResult: true});
      const useCase = new SendRequestToInterfaceUseCase({backupRequestRepo: repo, backupInterfaceAdapater: adapter});
      const dto = { ...baseDto };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isLeft()).toBe(true);
   });

   test('when send message fails, it returns failure', async () => {
      // Arrange
      const resultBackupRequest = BackupRequest.create(
         {
            ...backupRequestProps,
            backupJobId: 'sendMessage fails'
         }
      ).getValue();
      const repo = backupRequestRepoFactory({getByIdResult: resultBackupRequest});
      const adapter = backupInterfaceAdapterFactory({sendMessageResult: false});
      const useCase = new SendRequestToInterfaceUseCase({backupRequestRepo: repo, backupInterfaceAdapater: adapter});
      const dto = { ...baseDto };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isLeft()).toBe(true);
   });
});