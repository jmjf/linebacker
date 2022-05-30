import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';

import { BackupJob, IBackupJobProps } from '../../../backup/domain/BackupJob';
import { backupJobServiceAdapterFactory } from '../../../backup/test-utils/backupJobServiceAdapterFactory';
import { BackupProviderTypeValues } from '../../../backup/domain/BackupProviderType';

import { BackupResultTypeValues } from '../../domain/BackupResultType';
import { RequestStatusTypeValues } from '../../domain/RequestStatusType';
import { RequestTransportTypeValues } from '../../domain/RequestTransportType';

import { CreateBackupReplyDTO } from './CreateBackupReplyDTO';
import { ReceiveCreateBackupReplyUseCase } from './ReceiveCreateBackupReplyUseCase';

import { MockPrismaContext, PrismaContext, createMockPrismaContext } from '../../../common/infrastructure/database/prismaContext';
import { Backup, BackupRequest } from '@prisma/client';
import { PrismaBackupRequestRepo } from '../../adapter/impl/PrismaBackupRequestRepo';
import { PrismaBackupRepo } from '../../../backup/adapter/impl/PrismaBackupRepo';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime';

describe('ReceiveCreateBackupReplyUseCase', () => {
   let mockPrismaCtx: MockPrismaContext;
   let prismaCtx: PrismaContext;

   beforeEach(() => {
      mockPrismaCtx = createMockPrismaContext();
      prismaCtx = mockPrismaCtx as unknown as PrismaContext;
    });

   const createBackupReply: CreateBackupReplyDTO = {
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

   const dbBackupRequest: BackupRequest = {
      backupRequestId: 'dbBackupRequestId',
      backupJobId: 'dbBackupJobId',
      dataDate: new Date(),
      preparedDataPathName: 'path',
      getOnStartFlag: true,
      transportTypeCode: RequestTransportTypeValues.HTTP,
      statusTypeCode: RequestStatusTypeValues.Sent,
      receivedTimestamp: new Date(),
      requesterId: 'dbRequesterId',
      backupProviderCode: 'CloudA',
      checkedTimestamp: new Date(),
      storagePathName: 'dbStoragePathName',
      sentToInterfaceTimestamp: new Date(),
      replyTimestamp: null,
      replyMessageText: null      
   };

   const prismaCode = 'P1010';

   describe('Data quality', () => {

      test(`when the backup request doesn't exist, it returns failure`, async () => {
         // Arrange
         
         // VS Code sometimes highlights mockPrismaCtx lines as errors (circular reference) -- it is usually wrong
         // findUnique() returns null if not found
         mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValue(null as unknown as BackupRequest);
         const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);

         const backupRepo = new PrismaBackupRepo(prismaCtx);
         const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');

         const backupJobServiceAdapter = backupJobServiceAdapterFactory();

         const useCase = new ReceiveCreateBackupReplyUseCase({backupRequestRepo, backupRepo, backupJobServiceAdapter});
         const dto = { ...createBackupReply, backupRequestId: `request doesn't exist` };

         // Act
         const result = await useCase.execute(dto);

         // Assert
         expect(result.isErr()).toBe(true);
         expect(backupRepoSaveSpy).not.toBeCalled();
         if (result.isErr()) { // type guard
            expect(result.error.name).toBe('NotFoundError');
            expect(result.error.message).toMatch(dto.backupRequestId);
         }
      });

      test(`when the backup job doesn't exist, it returns failure`, async () => {
         // Arrange

         // VS Code sometimes highlights mockPrismaCtx lines as errors (circular reference) -- it is usually wrong
         mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValue(dbBackupRequest);
         const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);

         const backupRepo = new PrismaBackupRepo(prismaCtx);
         const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');

         const backupJobServiceAdapter = backupJobServiceAdapterFactory();

         const useCase = new ReceiveCreateBackupReplyUseCase({backupRequestRepo, backupRepo, backupJobServiceAdapter});
         const dto = { ...createBackupReply, backupRequestId: `job doesn't exist`  };

         // Act
         const result = await useCase.execute(dto);

         // Assert
         expect(result.isErr()).toBe(true);
         expect(backupRepoSaveSpy).not.toBeCalled();
         if (result.isErr()) { // type guard
            expect(result.error.name).toBe('BackupJobServiceError');
            // future, test message
         }
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

         // VS Code sometimes highlights mockPrismaCtx lines as errors (circular reference) -- it is usually wrong
         mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValue(dbBackupRequest);      
         const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);

         const backupRepo = new PrismaBackupRepo(prismaCtx);
         const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');

         const backupJob = BackupJob.create(backupJobDTO, new UniqueIdentifier(`backupJob-${propName}`)).unwrapOr({} as BackupJob);
         const backupJobServiceAdapter = backupJobServiceAdapterFactory({ getBackupJobResult: backupJob });

         const useCase = new ReceiveCreateBackupReplyUseCase({backupRequestRepo, backupRepo, backupJobServiceAdapter});
         const dto = { ...createBackupReply };
         // eslint-disable-next-line @typescript-eslint/ban-ts-comment
         // @ts-ignore
         dto[propName] = undefined;

         // Act
         const result = await useCase.execute(dto);

         // Assert
         expect(result.isErr()).toBe(true);
         expect(backupRepoSaveSpy).not.toBeCalled();
         if (result.isErr()) { // type guard
            expect(result.error.name).toBe('PropsError');
            expect(result.error.message).toMatch(propName);
         }
      });

      test('when result type is invalid, it returns failure', async () => {
         // Arrange
   
         // VS Code sometimes highlights mockPrismaCtx lines as errors (circular reference) -- it is usually wrong
         mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValue(dbBackupRequest);      
         const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);
   
         const backupRepo = new PrismaBackupRepo(prismaCtx);
         const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');
   
         const backupJob = BackupJob.create(backupJobDTO, new UniqueIdentifier('backupJob-invalidType')).unwrapOr({} as BackupJob);
   
         const backupJobServiceAdapter = backupJobServiceAdapterFactory({ getBackupJobResult: backupJob });
   
         const useCase = new ReceiveCreateBackupReplyUseCase({backupRequestRepo, backupRepo, backupJobServiceAdapter});
         const dto = { ...createBackupReply };
         // eslint-disable-next-line @typescript-eslint/ban-ts-comment
         // @ts-ignore
         dto.resultTypeCode = 'INVALID';
   
         // Act
         const result = await useCase.execute(dto);
   
         // Assert
         expect(result.isErr()).toBe(true);
         expect(backupRepoSaveSpy).not.toBeCalled();
         if (result.isErr()) { // type guard
            expect(result.error.name).toBe('PropsError');
            expect(result.error.message).toMatch('resultTypeCode');
         }
      });
   });

   test.each([
      RequestStatusTypeValues.Succeeded,
      RequestStatusTypeValues.Failed
   ])('when request is %p, it returns ok with unchanged status and timestamp', async (status) => {
      // Arrange
      const resultBackupRequest = {
         ...dbBackupRequest,
         statusTypeCode: status,
         replyTimestamp: new Date()
      };
      
      // VS Code sometimes highlights mockPrismaCtx lines as errors (circular reference) -- it is usually wrong
      mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValue(resultBackupRequest);      
      
      const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);
      const expectedTimestamp = resultBackupRequest.replyTimestamp;

      const backupRepo = new PrismaBackupRepo(prismaCtx);
      const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');

      const backupJob = BackupJob.create(backupJobDTO, new UniqueIdentifier(`backupJob-${status}`)).unwrapOr({} as BackupJob);
      const backupJobServiceAdapter = backupJobServiceAdapterFactory({ getBackupJobResult: backupJob });

      const useCase = new ReceiveCreateBackupReplyUseCase({backupRequestRepo, backupRepo, backupJobServiceAdapter});
      const dto = { ...createBackupReply };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isOk()).toBe(true);
      expect(backupRepoSaveSpy).not.toBeCalled();
      if (result.isOk()) { // type guard
         const value = result.value as unknown as BackupRequest;
         expect(value?.statusTypeCode).toMatch(status);
         expect(value?.replyTimestamp?.valueOf()).toBe(expectedTimestamp.valueOf());
      }
   });   

   test('when result type is Failed, it saves the request but not the backup record', async () => {
      // Arrange

      // VS Code sometimes highlights mockPrismaCtx lines as errors (circular reference) -- it is usually wrong
      mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValue(dbBackupRequest);    

      const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);
      const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

      const backupRepo = new PrismaBackupRepo(prismaCtx);
      const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');
      
      const backupJob = BackupJob.create(backupJobDTO, new UniqueIdentifier('backupJob-Failed')).unwrapOr({} as BackupJob);
      const backupJobServiceAdapter = backupJobServiceAdapterFactory({ getBackupJobResult: backupJob });
      
      const useCase = new ReceiveCreateBackupReplyUseCase({backupRequestRepo, backupRepo, backupJobServiceAdapter});
      const dto = { ...createBackupReply };
      dto.resultTypeCode = BackupResultTypeValues.Failed;
      dto.messageText = 'test failure';

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isOk()).toBe(true);
      expect(backupRequestSaveSpy).toBeCalledTimes(1);
      expect(backupRepoSaveSpy).not.toBeCalled();
      if (result.isOk()) { // type guard
         expect(result.value.constructor.name).toBe('BackupRequest');
         expect((result.value as unknown as BackupRequest).replyMessageText).toBe(dto.messageText);
      }

   });

   describe('Partial update idempotence', () => {

      test(`when reply is Succeeded but BackupRepo.save() fails, it doesn't save the BackupRequest and returns an Err`, async () => {
         // Arrange

         // VS Code sometimes highlights mockPrismaCtx lines as errors (circular reference) -- it is usually wrong

         mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValue(dbBackupRequest);
         // BackupRequest save() should never be called, so don't need a mock result
         const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);
         const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');
      
         // Backup save() will fail
         mockPrismaCtx.prisma.backup.upsert.mockRejectedValue(new PrismaClientKnownRequestError('Some upsert failure', prismaCode, '2'));
         const backupRepo = new PrismaBackupRepo(prismaCtx);
         const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');
         
         const backupJob = BackupJob.create(backupJobDTO, new UniqueIdentifier('backupJob')).unwrapOr({} as BackupJob);
         const backupJobServiceAdapter = backupJobServiceAdapterFactory({ getBackupJobResult: backupJob });
         
         const useCase = new ReceiveCreateBackupReplyUseCase({backupRequestRepo, backupRepo, backupJobServiceAdapter});
         const dto = { ...createBackupReply };
         dto.resultTypeCode = BackupResultTypeValues.Succeeded;

         // Act
         const result = await useCase.execute(dto);

         // Assert
         expect(result.isErr()).toBe(true);
         expect(backupRepoSaveSpy).toBeCalledTimes(1);
         expect(backupRequestSaveSpy).not.toBeCalled(); // never called, so the Err must be from backupRepo
         if (result.isErr()) {// type guard
            expect(result.error.name).toBe('DatabaseError');
         }
      });

      test(`when reply is Succeeded and BackupRepo.save() succeeds but BackupReplyRepo.save() fails, it returns an Err`, async () => {
         // Arrange

         // VS Code sometimes highlights mockPrismaCtx lines as errors (circular reference) -- it is usually wrong

         mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValue(dbBackupRequest);
         // BackupRequest save() will fail
         mockPrismaCtx.prisma.backupRequest.upsert.mockRejectedValue(new PrismaClientKnownRequestError('Some upsert failure', prismaCode, '2'));
         const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);
         const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');
      
         mockPrismaCtx.prisma.backup.upsert.mockResolvedValue({} as Backup);
         const backupRepo = new PrismaBackupRepo(prismaCtx);
         const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');
         
         const backupJob = BackupJob.create(backupJobDTO, new UniqueIdentifier('backupJob')).unwrapOr({} as BackupJob);
         const backupJobServiceAdapter = backupJobServiceAdapterFactory({ getBackupJobResult: backupJob });
         
         const useCase = new ReceiveCreateBackupReplyUseCase({backupRequestRepo, backupRepo, backupJobServiceAdapter});
         const dto = { ...createBackupReply };
         dto.resultTypeCode = BackupResultTypeValues.Succeeded;

         // Act
         const result = await useCase.execute(dto);

         // Assert
         expect(result.isErr()).toBe(true);
         expect(backupRepoSaveSpy).toBeCalledTimes(1);
         expect(backupRequestSaveSpy).toBeCalledTimes(1);
         if (result.isErr()) {// type guard
            expect(result.error.name).toBe('DatabaseError');
         }
      });   

      test('when reply is Succeeded and both repo save()s succeed, it returns Ok', async () => {
         // Arrange

         // VS Code sometimes highlights mockPrismaCtx lines as errors (circular reference) -- it is usually wrong

         mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValue(dbBackupRequest);
         mockPrismaCtx.prisma.backupRequest.upsert.mockResolvedValue({} as BackupRequest);
         const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);
         const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');
      
         mockPrismaCtx.prisma.backup.upsert.mockResolvedValue({} as Backup);
         const backupRepo = new PrismaBackupRepo(prismaCtx);
         const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');
         
         const backupJob = BackupJob.create(backupJobDTO, new UniqueIdentifier('backupJob')).unwrapOr({} as BackupJob);
         const backupJobServiceAdapter = backupJobServiceAdapterFactory({ getBackupJobResult: backupJob });
         
         const useCase = new ReceiveCreateBackupReplyUseCase({backupRequestRepo, backupRepo, backupJobServiceAdapter});
         const dto = { ...createBackupReply };
         dto.resultTypeCode = BackupResultTypeValues.Succeeded;

         // Act
         const result = await useCase.execute(dto);

         // Assert
         expect(result.isOk()).toBe(true);
         expect(backupRequestSaveSpy).toBeCalledTimes(1);
         expect(backupRepoSaveSpy).toBeCalledTimes(1);
         if (result.isOk()) {// type guard
            expect(result.value.constructor.name).toBe('Backup');
         }
      });
   });
});