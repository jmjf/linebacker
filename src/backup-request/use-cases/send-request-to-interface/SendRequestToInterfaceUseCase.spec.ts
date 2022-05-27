import { RequestTransportTypeValues } from '../../domain/RequestTransportType';
import { RequestStatusTypeValues } from '../../domain/RequestStatusType';

import { backupInterfaceAdapterFactory } from '../../test-utils/backupInterfaceAdapterFactory';

import { SendRequestToInterfaceUseCase } from './SendRequestToInterfaceUseCase';
import { SendRequestToInterfaceDTO } from './SendRequestToInterfaceDTO';

import { MockPrismaContext, PrismaContext, createMockPrismaContext } from '../../../common/infrastructure/database/prismaContext';
import { BackupRequest } from '@prisma/client';
import { PrismaBackupRequestRepo } from '../../adapter/impl/PrismaBackupRequestRepo';


describe('Send Request To Interface Use Case', () => {
   let mockPrismaCtx: MockPrismaContext;
   let prismaCtx: PrismaContext;

   beforeEach(() => {
      mockPrismaCtx = createMockPrismaContext();
      prismaCtx = mockPrismaCtx as unknown as PrismaContext;
    });

   const baseDto = {
      backupRequestId: 'testRequest'
   } as SendRequestToInterfaceDTO;

   const dbBackupRequest: BackupRequest = {
      backupRequestId: 'dbBackupRequestId',
      backupJobId: 'dbBackupJobId',
      dataDate: new Date(),
      preparedDataPathName: 'path',
      getOnStartFlag: true,
      transportTypeCode: RequestTransportTypeValues.HTTP,
      statusTypeCode: RequestStatusTypeValues.Allowed,
      receivedTimestamp: new Date(),
      requesterId: 'dbRequesterId',
      backupProviderCode: 'CloudA',
      checkedTimestamp: new Date(),
      storagePathName: 'dbStoragePathName',
      sentToInterfaceTimestamp: null,
      replyTimestamp: null,
      replyMessageText: null      
   };

   test('when request is Allowed, it returns a BackupRequest in Sent status', async () => {
      // Arrange
      const startTimestamp = new Date();

      // VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
      mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValue(dbBackupRequest);      

      const repo = new PrismaBackupRequestRepo(prismaCtx);

      const adapter = backupInterfaceAdapterFactory({sendMessageResult: true});
      
      const useCase = new SendRequestToInterfaceUseCase({backupRequestRepo: repo, backupInterfaceAdapter: adapter});
      const dto = { ...baseDto };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isOk()).toBe(true);
      if (result.isOk()) { // type guard makes the rest easier
         expect(result.value.statusTypeCode).toBe(RequestStatusTypeValues.Sent);
         expect(result.value.sentToInterfaceTimestamp.valueOf()).toBeGreaterThan(startTimestamp.valueOf());
      }
   });

   test.each([
      { status: RequestStatusTypeValues.Sent, timestampName: 'sentToInterfaceTimestamp' },
      { status: RequestStatusTypeValues.Failed, timestampName: 'replyTimestamp' },
      { status: RequestStatusTypeValues.Succeeded, timestampName: 'replyTimestamp' }
   ])('when request is $status, it returns a BackupRequest in $status status with $timestampName unchanged', async ({status, timestampName}) => {
      // Arrange
      const resultBackupRequest: {[index: string]:any} = 
         {
            ...dbBackupRequest,
            backupJobId: 'request is sent job id',
            statusTypeCode: status
         };
      resultBackupRequest[timestampName] = new Date();
      const expectedTimestamp = new Date(resultBackupRequest[timestampName]); // ensure we have a separate instance

      // VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
      mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValue(resultBackupRequest as BackupRequest);      

      const repo = new PrismaBackupRequestRepo(prismaCtx);

      const adapter = backupInterfaceAdapterFactory({sendMessageResult: true});

      const useCase = new SendRequestToInterfaceUseCase({backupRequestRepo: repo, backupInterfaceAdapter: adapter});
      const dto = { ...baseDto };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isOk()).toBe(true);
      if (result.isOk()) { // type guard
         const value: {[index: string]: any} = result.value;
         expect(value.statusTypeCode).toBe(status);
         expect(value[timestampName].valueOf()).toBe(expectedTimestamp.valueOf());
      }
   });

   test('when backup request does not exist, it returns failure', async () => {
      // Arrange

      // findUnique() returns null if not found
      // VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
      mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValue(null as unknown as BackupRequest);

      const repo = new PrismaBackupRequestRepo(prismaCtx);

      const adapter = backupInterfaceAdapterFactory({sendMessageResult: true});

      const useCase = new SendRequestToInterfaceUseCase({backupRequestRepo: repo, backupInterfaceAdapter: adapter});
      const dto = { ...baseDto };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isErr()).toBe(true);
      if (result.isErr()) { // type guard
         expect(result.error.name).toBe('DatabaseError');
      }
   });

   test('when request is in NotAllowed status, it returns failure', async () => {
      // Arrange
      const resultBackupRequest: BackupRequest = 
         {
            ...dbBackupRequest,
            backupJobId: 'request NotAllowed job id',
            statusTypeCode: 'NotAllowed',
            checkedTimestamp: new Date()
         };

      // VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
      mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValue(resultBackupRequest);      

      const repo = new PrismaBackupRequestRepo(prismaCtx);

      const adapter = backupInterfaceAdapterFactory({sendMessageResult: true});

      const useCase = new SendRequestToInterfaceUseCase({backupRequestRepo: repo, backupInterfaceAdapter: adapter});
      const dto = { ...baseDto };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isErr()).toBe(true);
      if (result.isErr()) { // type guard
         expect(result.error.name).toBe('BackupRequestStatusError');
         expect(result.error.message).toMatch('in Allowed');
      }
   });

   test('when send message fails, it returns failure', async () => {
      // Arrange
      const resultBackupRequest: BackupRequest = 
         {
            ...dbBackupRequest,
            backupJobId: 'send fails job id',
         };

      // VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
      mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValue(resultBackupRequest);      

      const repo = new PrismaBackupRequestRepo(prismaCtx);

      const adapter = backupInterfaceAdapterFactory({sendMessageResult: false});
      
      const useCase = new SendRequestToInterfaceUseCase({backupRequestRepo: repo, backupInterfaceAdapter: adapter});
      const dto = { ...baseDto };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isErr()).toBe(true);
      if (result.isErr()) { // type guard
         expect(result.error.name).toBe('SendToInterfaceError');
      }
   });
});