import { BackupRequest } from '../../domain/BackupRequest';
import { backupJobServiceAdapterFactory } from '../../test-utils/backupJobServiceAdapterFactory';
import { backupRepoFactory } from '../../test-utils/backupRepoFactory';
import { backupRequestRepoFactory } from '../../test-utils/backupRequestRepoFactory';
import { BackupStatusReplyDTO } from './BackupStatusReplyDTO';
import { CreateBackupRecordUseCase } from './CreateBackupRecordUseCase';

describe('Create Backup Record Use Case', () => {
   const backupStatusDTO = {
      apiVersion: '2022-01-01',
      backupRequestId: 'backup request',
      storagePathName: '/path/to/backup/storage',
      resultTypeCode: 'Succeeded',
      backupByteCount: 1000000,
      copyStartTimestamp: '2022-05-06T00:20:03.111Z',
      copyEndTimestamp: '2022-05-06T00:32:23.888Z'
   } as BackupStatusReplyDTO;

   test(`when the backup request doesn't exist, it returns failure`, async () => {
      // Arrange
      const backupRequestRepo = backupRequestRepoFactory();
      const backupRepo = backupRepoFactory();
      const backupJobServiceAdapter = backupJobServiceAdapterFactory();
      const useCase = new CreateBackupRecordUseCase({backupRequestRepo, backupRepo, backupJobServiceAdapter});
      const dto = { ...backupStatusDTO };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isLeft()).toBe(true);
      expect(result.value.errorValue()).toMatch('Backup request not found');
   });

   test(`when the backup job doesn't exist, it returns failure`, async () => {
      // Arrange
      const backupRequestRepo = backupRequestRepoFactory({ getByIdResult: {} as BackupRequest });
      const backupRepo = backupRepoFactory();
      const backupJobServiceAdapter = backupJobServiceAdapterFactory();
      const useCase = new CreateBackupRecordUseCase({backupRequestRepo, backupRepo, backupJobServiceAdapter});
      const dto = { ...backupStatusDTO };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isLeft()).toBe(true);
      expect(result.value.errorValue()).toMatch('Backup job not found');
   });
});