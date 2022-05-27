import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';

import { BackupJob, IBackupJobProps } from '../../../backup/domain/BackupJob';
import { BackupProviderTypeValues } from '../../../backup/domain/BackupProviderType';
import { backupJobServiceAdapterFactory } from '../../../backup/test-utils/backupJobServiceAdapterFactory';

import { RequestStatusType, RequestStatusTypeValues } from '../../domain/RequestStatusType';
import { RequestTransportTypeValues } from '../../domain/RequestTransportType';

import { CheckRequestAllowedDTO } from './CheckRequestAllowedDTO';
import { CheckRequestAllowedUseCase } from './CheckRequestAllowedUseCase';

import { MockPrismaContext, PrismaContext, createMockPrismaContext } from '../../../common/infrastructure/database/prismaContext';
import { BackupRequest } from '@prisma/client';
import { PrismaBackupRequestRepo } from '../../adapter/impl/PrismaBackupRequestRepo';

describe('CheckRequestAllowedUseCase', () => {
   let mockPrismaCtx: MockPrismaContext;
   let prismaCtx: PrismaContext;

   beforeEach(() => {
      mockPrismaCtx = createMockPrismaContext();
      prismaCtx = mockPrismaCtx as unknown as PrismaContext;
    });

   const baseDto: CheckRequestAllowedDTO = {
      backupRequestId: 'checkAllowedRequestId'
   };

   const backupJobProps: IBackupJobProps = {
      storagePathName: 'my/storage/path',
      backupProviderCode: BackupProviderTypeValues.CloudA,
      daysToKeep: 3650,
      isActive: true,
      holdFlag: false
   };

   const dbBackupRequest: BackupRequest = {
      backupRequestId: 'dbBackupRequestId',
      backupJobId: 'dbBackupJobId',
      dataDate: new Date(),
      preparedDataPathName: 'path',
      getOnStartFlag: true,
      transportTypeCode: RequestTransportTypeValues.HTTP,
      statusTypeCode: RequestStatusTypeValues.Received,
      receivedTimestamp: new Date(),
      requesterId: 'dbRequesterId',
      backupProviderCode: null,
      storagePathName: null,
      checkedTimestamp: null,
      sentToInterfaceTimestamp: null,
      replyTimestamp: null,
      replyMessageText: null
   };

   test('when backup job for request meets allowed rules, it returns a BackupRequest in Allowed status', async () => {
      // Arrange

      // VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
      mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValue(dbBackupRequest);      

      const repo = new PrismaBackupRequestRepo(prismaCtx);

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

      // findUnique() returns null if not found
      // VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
      mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValue(null as unknown as BackupRequest);

      const repo = new PrismaBackupRequestRepo(prismaCtx);

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
         expect(result.error.name).toBe('NotFoundError');
         expect(result.error.message).toMatch(dto.backupRequestId);
      }
   });

   test('when backup job is not found, it returns failure', async () => {
      // Arrange

      // VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
      mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValue(dbBackupRequest);      

      const repo = new PrismaBackupRequestRepo(prismaCtx);

      const adapter = backupJobServiceAdapterFactory();
      
      const useCase = new CheckRequestAllowedUseCase({backupRequestRepo: repo, backupJobServiceAdapter: adapter});
      const dto = { ...baseDto };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isErr()).toBe(true);
      if (result.isErr()) { // type guard
         expect(result.error.name).toBe('BackupJobServiceError');
         // future test message too
      }
   });

   test('when request status type is not post-received value and not Received, it returns failure', async () => {
      // Arrange

      // VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
      mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValue({ ...dbBackupRequest, statusTypeCode: 'INVALID'});      

      const repo = new PrismaBackupRequestRepo(prismaCtx);

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
      const resultBackupRequest: {[index: string]:any} = {
         ...dbBackupRequest,
         statusTypeCode: status as RequestStatusType
      };
      resultBackupRequest[timestamp] = new Date();

      // VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
      mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValue(resultBackupRequest as BackupRequest);      

      const repo = new PrismaBackupRequestRepo(prismaCtx);

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