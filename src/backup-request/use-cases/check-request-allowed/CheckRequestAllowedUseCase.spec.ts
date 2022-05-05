import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';
import { BackupJob, IBackupJobProps } from '../../domain/BackupJob';
import { BackupRequest, IBackupRequestProps } from '../../domain/BackupRequest';
import { backupJobServiceAdapterFactory } from '../../test-utils/backupJobServiceAdapterFactory';
import { backupRequestRepoFactory } from '../../test-utils/backupRequestRepoFactory';
import { CheckRequestAllowedDTO } from './CheckRequestAllowedDTO';
import { CheckRequestAllowedUseCase } from './CheckRequestAllowedUseCase';

describe('Check Request Allowed Use Case', () => {
   const baseDto = {
      backupRequestId: 'job'
   } as CheckRequestAllowedDTO;

   const backupRequestProps = {
      backupJobId: 'job',
      dataDate: new Date(),
      preparedDataPathName: 'path',
      getOnStartFlag: true,
      transportTypeCode: 'HTTP',
      statusTypeCode: 'Received',
      receivedTimestamp: new Date()  
   } as IBackupRequestProps;

   const backupJobProps = {
      storagePathName: 'my/storage/path',
      backupProviderCode: 'CloudA',
      daysToKeep: 3650,
      isActive: true
   } as IBackupJobProps;

   test('when backup job for request is allowed, it returns a BackupRequest in Allowed status', async () => {
      // Arrange
      const startTimestamp = new Date();
      const resultBackupJob = BackupJob.create(
         {
            ...backupJobProps,
         }, new UniqueIdentifier('backup-job-01')).getValue();
      const resultBackupRequest = BackupRequest.create(backupRequestProps).getValue();
      const repo = backupRequestRepoFactory({getByIdResult: resultBackupRequest});
      const adapter = backupJobServiceAdapterFactory({getBackupJobResult: resultBackupJob});
      const useCase = new CheckRequestAllowedUseCase({backupRequestRepo: repo, backupJobServiceAdapter: adapter});
      const dto = { ...baseDto };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isRight()).toBe(true);
      expect(result.value.getValue().statusTypeCode).toBe('Allowed');
      expect(result.value.getValue().checkedTimestamp.valueOf()).toBeGreaterThan(startTimestamp.valueOf());
   });
});