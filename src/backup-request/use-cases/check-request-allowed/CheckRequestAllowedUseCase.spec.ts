import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';

import { BackupJob, IBackupJobProps } from '../../../backup/domain/BackupJob';
import { BackupProviderTypeValues } from '../../../backup/domain/BackupProviderType';
import { backupJobServiceAdapterFactory } from '../../../backup/test-utils/backupJobServiceAdapterFactory';

import { BackupRequest, IBackupRequestProps } from '../../domain/BackupRequest';
import { RequestStatusType, RequestStatusTypeValues } from '../../domain/RequestStatusType';
import { RequestTransportTypeValues } from '../../domain/RequestTransportType';
import { backupRequestRepoFactory } from '../../test-utils/backupRequestRepoFactory';

import { CheckRequestAllowedDTO } from './CheckRequestAllowedDTO';
import { CheckRequestAllowedUseCase } from './CheckRequestAllowedUseCase';

describe('CheckRequestAllowedUseCase', () => {
   const baseDto: CheckRequestAllowedDTO = {
      backupRequestId: 'job'
   };

   const backupRequestProps: IBackupRequestProps = {
      backupJobId: new UniqueIdentifier('job'),
      dataDate: new Date(),
      preparedDataPathName: 'path',
      getOnStartFlag: true,
      transportTypeCode: RequestTransportTypeValues.HTTP,
      statusTypeCode: RequestStatusTypeValues.Received,
      receivedTimestamp: new Date()
   };

   const backupJobProps: IBackupJobProps = {
      storagePathName: 'my/storage/path',
      backupProviderCode: BackupProviderTypeValues.CloudA,
      daysToKeep: 3650,
      isActive: true,
      holdFlag: false
   };

   test('when backup job for request meets allowed rules, it returns a BackupRequest in Allowed status', async () => {
      // Arrange
      const resultBackupRequest = BackupRequest.create(backupRequestProps).unwrapOr({} as BackupRequest);
      const repo = backupRequestRepoFactory({getByIdResult: resultBackupRequest});

      const resultBackupJob = BackupJob.create(
         {
            ...backupJobProps,
         }, new UniqueIdentifier('backup-job-01')).unwrapOr({} as BackupJob);
      const adapter = backupJobServiceAdapterFactory({getBackupJobResult: resultBackupJob});
      
      const useCase = new CheckRequestAllowedUseCase({backupRequestRepo: repo, backupJobServiceAdapter: adapter});
      const dto = { ...baseDto };

      // Act
      const startTimestamp = new Date();
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isOk()).toBe(true);
      if (result.isOk()) { // type guard makes the rest easier
         expect(result.value.statusTypeCode).toBe(RequestStatusTypeValues.Allowed);
         expect(result.value.checkedTimestamp.valueOf()).toBeGreaterThanOrEqual(startTimestamp.valueOf());
      }
   });

   test('when backup request is not found by id, it returns failure', async () => {
      // Arrange
      const repo = backupRequestRepoFactory();

      const resultBackupJob = BackupJob.create(
         {
            ...backupJobProps,
         }, new UniqueIdentifier('backup-job-01')).unwrapOr({} as BackupJob);
      const adapter = backupJobServiceAdapterFactory({getBackupJobResult: resultBackupJob});

      const useCase = new CheckRequestAllowedUseCase({backupRequestRepo: repo, backupJobServiceAdapter: adapter});
      const dto = { ...baseDto };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isErr()).toBe(true);
      if (result.isErr()) { // type guard
         expect(result.error.name).toBe('DatabaseError');
      }
   });

   test('when backup job is not found, it returns failure', async () => {
      // Arrange
      const resultBackupRequest = BackupRequest.create(backupRequestProps).unwrapOr({} as BackupRequest);
      const repo = backupRequestRepoFactory({getByIdResult: resultBackupRequest});

      const adapter = backupJobServiceAdapterFactory();
      
      const useCase = new CheckRequestAllowedUseCase({backupRequestRepo: repo, backupJobServiceAdapter: adapter});
      const dto = { ...baseDto };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isErr()).toBe(true);
   });

   test('when request status type is not post-received value and not Received, it returns failure', async () => {
      // Arrange
      const resultBackupRequest = BackupRequest.create({
         ...backupRequestProps,
         statusTypeCode: 'INVALID' as RequestStatusType  // force it
         // BackupRequest doesn't check status is a valid value, if it did, this test would fail here
      }).unwrapOr({} as BackupRequest);
      const repo = backupRequestRepoFactory({getByIdResult: resultBackupRequest});

      const resultBackupJob = BackupJob.create(
         {
            ...backupJobProps,
         }, new UniqueIdentifier('backup-job-01')).unwrapOr({} as BackupJob);
      const adapter = backupJobServiceAdapterFactory({getBackupJobResult: resultBackupJob});
      const useCase = new CheckRequestAllowedUseCase({backupRequestRepo: repo, backupJobServiceAdapter: adapter});
      const dto = { ...baseDto };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isErr()).toBe(true);
      if (result.isErr()) { // type guard
         expect(result.error.name).toBe('BackupRequestStatusError');
         expect(result.error.message).toMatch('in Received');
      }
   });

   // test.each(statusTestCases) runs the same test with different data (defined in statusTestCases)
   // I had to coerce several types to get the test to behave, but now this one block of code tests all the cases
   const statusTestCases = [
      {status: RequestStatusTypeValues.Allowed, timestamp: 'checkedTimestamp'},
      {status: RequestStatusTypeValues.NotAllowed, timestamp: 'checkedTimestamp'},
      {status: RequestStatusTypeValues.Sent, timestamp: 'sentToInterfaceTimestamp'},
      {status: RequestStatusTypeValues.Succeeded, timestamp: 'replyTimestamp'},
      {status: RequestStatusTypeValues.Failed, timestamp: 'replyTimestamp'}
   ];
   test.each(statusTestCases)('when backup request is in $status status, it returns an unchanged BackupRequest', async ({status, timestamp}) => {
      // Arrange
      // timestamp that matters is defined in inputs, so need to add it after setting up base props         
      const reqProps: {[index: string]:any} = {
         ...backupRequestProps,
         statusTypeCode: status as RequestStatusType
      };
      reqProps[timestamp] = new Date();
      const resultBackupRequest = BackupRequest.create(reqProps as IBackupRequestProps).unwrapOr({} as BackupRequest);
      const repo = backupRequestRepoFactory({getByIdResult: resultBackupRequest});

      const resultBackupJob = BackupJob.create(
         {
            ...backupJobProps,
         }, new UniqueIdentifier('backup-job-01')).unwrapOr({} as BackupJob);
      const adapter = backupJobServiceAdapterFactory({getBackupJobResult: resultBackupJob});

      const useCase = new CheckRequestAllowedUseCase({backupRequestRepo: repo, backupJobServiceAdapter: adapter});
      const dto = { ...baseDto };

      // Act
      const startTimestamp = new Date();
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isOk()).toBe(true);
      if (result.isOk()) { // type guard
         const value = result.value as {[index: string]: any}; // required for value[timestamp]
         expect(value.statusTypeCode).toBe(status);
         expect((value[timestamp] as Date).valueOf()).toBeLessThanOrEqual(startTimestamp.valueOf());
      }
   });
});