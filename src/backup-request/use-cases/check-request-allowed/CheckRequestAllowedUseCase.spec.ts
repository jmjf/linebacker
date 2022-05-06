import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';
import { BackupJob, IBackupJobProps } from '../../domain/BackupJob';
import { BackupRequest, IBackupRequestProps } from '../../domain/BackupRequest';
import { RequestStatusType } from '../../domain/RequestStatusType';
import { backupJobServiceAdapterFactory } from '../../test-utils/backupJobServiceAdapterFactory';
import { backupRequestRepoFactory } from '../../test-utils/backupRequestRepoFactory';
import { CheckRequestAllowedDTO } from './CheckRequestAllowedDTO';
import { CheckRequestAllowedUseCase } from './CheckRequestAllowedUseCase';

describe('Check Request Allowed Use Case', () => {
   const baseDto: CheckRequestAllowedDTO = {
      backupRequestId: 'job'
   };

   const backupRequestProps: IBackupRequestProps = {
      backupJobId: 'job',
      dataDate: new Date(),
      preparedDataPathName: 'path',
      getOnStartFlag: true,
      transportTypeCode: 'HTTP',
      statusTypeCode: 'Received',
      receivedTimestamp: new Date()
   };

   const backupJobProps: IBackupJobProps = {
      storagePathName: 'my/storage/path',
      backupProviderCode: 'CloudA',
      daysToKeep: 3650,
      isActive: true,
      holdFlag: false
   };

   test('when backup job for request meets allowed rules, it returns a BackupRequest in Allowed status', async () => {
      // Arrange
      const resultBackupRequest = BackupRequest.create(backupRequestProps).getValue();
      const repo = backupRequestRepoFactory({getByIdResult: resultBackupRequest});

      const resultBackupJob = BackupJob.create(
         {
            ...backupJobProps,
         }, new UniqueIdentifier('backup-job-01')).getValue();
      const adapter = backupJobServiceAdapterFactory({getBackupJobResult: resultBackupJob});
      
      const useCase = new CheckRequestAllowedUseCase({backupRequestRepo: repo, backupJobServiceAdapter: adapter});
      const dto = { ...baseDto };

      // Act
      const startTimestamp = new Date();
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isRight()).toBe(true);
      expect(result.value.getValue().statusTypeCode).toBe('Allowed');
      expect(result.value.getValue().checkedTimestamp.valueOf()).toBeGreaterThanOrEqual(startTimestamp.valueOf());
   });

   test('when backup request is not found by id, it returns failure', async () => {
      // Arrange
      const repo = backupRequestRepoFactory();
      const resultBackupJob = BackupJob.create(
         {
            ...backupJobProps,
         }, new UniqueIdentifier('backup-job-01')).getValue();
      const adapter = backupJobServiceAdapterFactory({getBackupJobResult: resultBackupJob});
      const useCase = new CheckRequestAllowedUseCase({backupRequestRepo: repo, backupJobServiceAdapter: adapter});
      const dto = { ...baseDto };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isLeft()).toBe(true);
   });

   test('when backup job is not found, it returns failure', async () => {
      // Arrange
      const resultBackupRequest = BackupRequest.create(backupRequestProps).getValue();
      const repo = backupRequestRepoFactory({getByIdResult: resultBackupRequest});
      const adapter = backupJobServiceAdapterFactory();
      const useCase = new CheckRequestAllowedUseCase({backupRequestRepo: repo, backupJobServiceAdapter: adapter});
      const dto = { ...baseDto };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isLeft()).toBe(true);
   });

   test('when request status type is not post-received value and not Received, it returns failure', async () => {
      // Arrange
      const resultBackupRequest = BackupRequest.create({
         ...backupRequestProps,
         statusTypeCode: 'INVALID' as RequestStatusType  // force it
         // BackupRequest doesn't check status is a valid value, if it did, this test would fail here
      }).getValue();
      const repo = backupRequestRepoFactory({getByIdResult: resultBackupRequest});

      const resultBackupJob = BackupJob.create(
         {
            ...backupJobProps,
         }, new UniqueIdentifier('backup-job-01')).getValue();
      const adapter = backupJobServiceAdapterFactory({getBackupJobResult: resultBackupJob});
      const useCase = new CheckRequestAllowedUseCase({backupRequestRepo: repo, backupJobServiceAdapter: adapter});
      const dto = { ...baseDto };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isLeft()).toBe(true);
   });

   // test.each(statusTestCases) runs the same test with different data (defined in statusTestCases)
   // I had to coerce several types to get the test to behave, but now this one block of code tests all the cases
   const statusTestCases = [
      {status: 'Allowed', timestamp: 'checkedTimestamp'},
      {status: 'NotAllowed', timestamp: 'checkedTimestamp'},
      {status: 'Sent', timestamp: 'sentToInterfaceTimestamp'},
      {status: 'Succeeded', timestamp: 'replyTimestamp'},
      {status: 'Failed', timestamp: 'replyTimestamp'}
   ];
   test.each(statusTestCases)('when backup request is in $status status, it returns an unchanged BackupRequest', async ({status, timestamp}) => {
      // Arrange
      // timestamp that matters is defined in inputs, so need to add it after setting up base props         
      const reqProps: {[index: string]:any} = {
         ...backupRequestProps,
         statusTypeCode: status as RequestStatusType
      };
      reqProps[timestamp] = new Date();
      const resultBackupRequest = BackupRequest.create(reqProps as IBackupRequestProps).getValue();
      const repo = backupRequestRepoFactory({getByIdResult: resultBackupRequest});

      const resultBackupJob = BackupJob.create(
         {
            ...backupJobProps,
         }, new UniqueIdentifier('backup-job-01')).getValue();
      const adapter = backupJobServiceAdapterFactory({getBackupJobResult: resultBackupJob});

      const useCase = new CheckRequestAllowedUseCase({backupRequestRepo: repo, backupJobServiceAdapter: adapter});
      const dto = { ...baseDto };

      // Act
      const startTimestamp = new Date();
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isRight()).toBe(true);
      expect(result.value.getValue().statusTypeCode).toBe(status);
      expect(result.value.getValue()[timestamp].valueOf()).toBeLessThanOrEqual(startTimestamp.valueOf());
   });


});