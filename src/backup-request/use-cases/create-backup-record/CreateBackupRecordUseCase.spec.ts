import { create } from 'domain';
import { backupRepoFactory } from '../../test-utils/backupRepoFactory';
import { backupRequestRepoFactory } from '../../test-utils/backupRequestRepoFactory';
import { BackupStatusReplyDTO } from './BackupStatusReplyDTO';
import { CreateBackupRecordUseCase } from './CreateBackupRecordUseCase';

describe('Create Backup Record Use Case', () => {
   const backupStatusDTO = {
      apiVersion: '2022-01-01',
      backupRequestId: 'backup request',
      backupStorageLocation: '/path/to/backup/storage',
      resultType: 'Succeeded',
      backupBytes: 1000000,
      copyStartTimestamp: '2022-05-06T00:20:03.111Z',
      copyEndTimestamp: '2022-05-06T00:32:23.888Z'
   } as BackupStatusReplyDTO;

   test('initial test', async () => {
      // Arrange
      const backupRequestRepo = backupRequestRepoFactory();
      const backupRepo = backupRepoFactory();
      const useCase = new CreateBackupRecordUseCase({backupRequestRepo, backupRepo});
      const dto = { ...backupStatusDTO };

      // Act
      const result = await useCase.execute(dto);
      console.log('initial test', JSON.stringify(result));

      // Assert
      expect(result.isRight()).toBe(true);
   });
});