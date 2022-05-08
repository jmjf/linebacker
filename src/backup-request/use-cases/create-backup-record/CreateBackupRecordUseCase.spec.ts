import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';
import { BackupJob, IBackupJobProps } from '../../domain/BackupJob';
import { BackupProviderTypeValues } from '../../domain/BackupProviderType';
import { BackupRequest, IBackupRequestProps } from '../../domain/BackupRequest';
import { BackupResultTypeValues } from '../../domain/BackupResultType';
import { RequestStatusTypeValues } from '../../domain/RequestStatusType';
import { RequestTransportTypeValues } from '../../domain/RequestTransportType';
import { backupJobServiceAdapterFactory } from '../../test-utils/backupJobServiceAdapterFactory';
import { backupRepoFactory } from '../../test-utils/backupRepoFactory';
import { backupRequestRepoFactory } from '../../test-utils/backupRequestRepoFactory';
import { BackupStatusReplyDTO } from './BackupStatusReplyDTO';
import { CreateBackupRecordUseCase } from './CreateBackupRecordUseCase';

describe('Create Backup Record Use Case', () => {
   const backupStatusDTO: BackupStatusReplyDTO = {
      apiVersion: '2022-01-01',
      backupRequestId: 'backup request',
      storagePathName: '/path/to/backup/storage',
      resultTypeCode: BackupResultTypeValues.Succeeded,
      backupByteCount: 1000000,
      copyStartTimestamp: '2022-05-06T00:20:03.111Z',
      copyEndTimestamp: '2022-05-06T00:32:23.888Z'
   };

   const backupJobDTO: IBackupJobProps = {
      storagePathName: 'storage path',
      backupProviderCode: BackupProviderTypeValues.CloudB,
      daysToKeep: 100,
      isActive: true,
      holdFlag: false
   };

   const backupRequestDTO: IBackupRequestProps = {
      backupJobId: 'backup job',
      dataDate: new Date(),
      preparedDataPathName: 'prepared/path',
      getOnStartFlag: true,
      transportTypeCode: RequestTransportTypeValues.HTTP,
      statusTypeCode: RequestStatusTypeValues.Sent,
      receivedTimestamp: new Date()
   };

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

   // Can test attributes in BackupRequestReplyDTO because other values are set from retrieved data in the use case
   test.each( [
      { propName: 'backupRequestId' },
      { propName: 'storagePathName' },
      { propName: 'backupByteCount' },
      { propName: 'copyStartTimestamp' },
      { propName: 'copyEndTimestamp' }
   ])('when required reply attribute $propName is missing, it returns failure', async ({propName}) => {
      // Arrange
      const backupRequest = BackupRequest.create(backupRequestDTO).getValue();
      const backupRequestRepo = backupRequestRepoFactory({ getByIdResult: backupRequest });
      const backupRepo = backupRepoFactory();
      const backupJob = BackupJob.create(backupJobDTO, new UniqueIdentifier('backupJob')).getValue();
      const backupJobServiceAdapter = backupJobServiceAdapterFactory({ getBackupJobResult: backupJob });
      const useCase = new CreateBackupRecordUseCase({backupRequestRepo, backupRepo, backupJobServiceAdapter});
      const dto = { ...backupStatusDTO };
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      dto[propName] = undefined;

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isLeft()).toBe(true);
      expect(result.value.errorValue()).toMatch('is null or undefined');
      expect(result.value.errorValue()).toMatch(propName);
   });

   test('when result type is invalid, it returns failure', async () => {
      // Arrange
      const backupRequest = BackupRequest.create(backupRequestDTO).getValue();
      const backupRequestRepo = backupRequestRepoFactory({ getByIdResult: backupRequest });
      const backupRepo = backupRepoFactory();
      const backupJob = BackupJob.create(backupJobDTO, new UniqueIdentifier('backupJob')).getValue();
      const backupJobServiceAdapter = backupJobServiceAdapterFactory({ getBackupJobResult: backupJob });
      const useCase = new CreateBackupRecordUseCase({backupRequestRepo, backupRepo, backupJobServiceAdapter});
      const dto = { ...backupStatusDTO };
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      dto.resultTypeCode = 'INVALID';

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isLeft()).toBe(true);
      expect(result.value.errorValue()).toMatch('resultTypeCode is invalid');
   });

   test('when result type is Failed, it saves the request but not the backup record', async () => {
      // Arrange
      const backupRequest = BackupRequest.create(backupRequestDTO).getValue();
      const backupRequestRepo = backupRequestRepoFactory({ getByIdResult: backupRequest });
      const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

      const backupRepo = backupRepoFactory();
      const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');
      
      const backupJob = BackupJob.create(backupJobDTO, new UniqueIdentifier('backupJob')).getValue();
      const backupJobServiceAdapter = backupJobServiceAdapterFactory({ getBackupJobResult: backupJob });
      
      const useCase = new CreateBackupRecordUseCase({backupRequestRepo, backupRepo, backupJobServiceAdapter});
      const dto = { ...backupStatusDTO };
      dto.resultTypeCode = BackupResultTypeValues.Failed;
      dto.messageText = 'test failure';

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isRight()).toBe(true);
      expect(result.value.getValue().constructor.name).toBe('BackupRequest');
      expect(result.value.getValue().replyMessageText).toBe(dto.messageText);
      expect(backupRequestSaveSpy).toBeCalledTimes(1);
      expect(backupRepoSaveSpy).not.toBeCalled();
   });

   test('when result type is Succeeded, it saves the request and the backup record', async () => {
      // Arrange
      const backupRequest = BackupRequest.create(backupRequestDTO).getValue();
      const backupRequestRepo = backupRequestRepoFactory({ getByIdResult: backupRequest });
      const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

      const backupRepo = backupRepoFactory();
      const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');
      
      const backupJob = BackupJob.create(backupJobDTO, new UniqueIdentifier('backupJob')).getValue();
      const backupJobServiceAdapter = backupJobServiceAdapterFactory({ getBackupJobResult: backupJob });
      
      const useCase = new CreateBackupRecordUseCase({backupRequestRepo, backupRepo, backupJobServiceAdapter});
      const dto = { ...backupStatusDTO };
      dto.resultTypeCode = BackupResultTypeValues.Succeeded;

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isRight()).toBe(true);
      expect(result.value.getValue().constructor.name).toBe('Backup');
      expect(backupRequestSaveSpy).toBeCalledTimes(1);
      expect(backupRepoSaveSpy).toBeCalledTimes(1);
   });
});