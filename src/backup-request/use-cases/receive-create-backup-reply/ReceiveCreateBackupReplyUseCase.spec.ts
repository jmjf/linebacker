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
import { DatabaseError } from '../../../common/adapter/AdapterErrors';

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
      storagePathName: 'storage/path',
      backupProviderCode: BackupProviderTypeValues.CloudB,
      daysToKeep: 100,
      isActive: true,
      holdFlag: false
   };

   const dbBackupRequest: BackupRequest = {
      backupRequestId: 'dbBackupRequestId',
      backupJobId: 'dbBackupJobId',
      dataDate: new Date(),
      preparedDataPathName: 'prepared/data/path',
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

   const prismaBackup: Backup = {
      backupId: 'backupId',
      backupRequestId: 'dbBackupRequestId',
      backupJobId: 'dbBackupJobId',
      dataDate: new Date('2022-05-30'),
      backupProviderCode: 'CloudA',
      storagePathName: 'path/to/backup/storage/prisma',
      daysToKeepCount: 42,
      holdFlag: false,
      backupByteCount: BigInt(9999999),
      copyStartTimestamp: new Date('2022-05-30T20:00:00Z'),
      copyEndTimestamp: new Date('2022-05-30T20:11:11Z'),
      verifyStartTimestamp: new Date('2022-05-30T20:11:33Z'),
      verifyEndTimestamp: new Date('2022-05-30T20:20:44Z'),
      verifyHashText: 'verifyHash',
      dueToDeleteDate: new Date('2029-04-30'),
      deletedTimestamp: null as unknown as Date
   }

   const prismaCode = 'P1010';

   test('when reply status is Failed, it calls BackupRequest save() but not Backup save()', async () => {
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

   describe('Data integrity', () => {
      test(`when the BackupRequest doesn't exist, it returns failure`, async () => {
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

      test(`when the BackupJob doesn't exist, it returns failure`, async () => {
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
   });

   describe('Reply data quality', () => {

      test('when reply status is invalid, it returns Err', async () => {
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

         mockPrismaCtx.prisma.backup.findFirst.mockResolvedValue(null as unknown as Backup);
         mockPrismaCtx.prisma.backup.upsert.mockResolvedValue({} as Backup);
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
         mockPrismaCtx.prisma.backup.findFirst.mockResolvedValue(null as unknown as Backup);
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
            // ensure it fails in the BackupRepo.save, not some other DatabaseError
            expect((result.error as DatabaseError).functionName).toBe('PrismaBackupRepo.save');
         }
      });

      test(`when reply is Succeeded and BackupRepo.save() succeeds but BackupRequestRepo.save() fails, it returns an Err`, async () => {
         // Arrange

         // VS Code sometimes highlights mockPrismaCtx lines as errors (circular reference) -- it is usually wrong

         mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValue(dbBackupRequest);
         // BackupRequest save() will fail
         mockPrismaCtx.prisma.backupRequest.upsert.mockRejectedValue(new PrismaClientKnownRequestError('Some upsert failure', prismaCode, '2'));
         const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);
         const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');
      
         mockPrismaCtx.prisma.backup.findFirst.mockResolvedValue(null as unknown as Backup);
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
            // ensure it fails in the BackupRequestRepo.save, not some other DatabaseError
            expect((result.error as DatabaseError).functionName).toBe('PrismaBackupRequestRepo.save');
         }
      });   

      test('when reply is Succeeded and both repo save()s succeed, it returns Ok', async () => {
         // Arrange

         // VS Code sometimes highlights mockPrismaCtx lines as errors (circular reference) -- it is usually wrong

         mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValue(dbBackupRequest);
         mockPrismaCtx.prisma.backupRequest.upsert.mockResolvedValue({} as BackupRequest);
         const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);
         const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');
      
         mockPrismaCtx.prisma.backup.findFirst.mockResolvedValue(null as unknown as Backup);
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

   describe('Duplicate reply idempotence', () => {
      test('when the Backup exists, the BackupRequest is not complete, and the BackupRequest save() fails, it returns Err and does not call Backup save()', async () => {
         // Arrange

         // VS Code sometimes highlights mockPrismaCtx lines as errors (circular reference) -- it is usually wrong

         mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValue(dbBackupRequest);
         mockPrismaCtx.prisma.backupRequest.upsert.mockRejectedValue(new PrismaClientKnownRequestError('rejected', prismaCode, '2'));
         const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);
         const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

         // findFirst() for getByBackupRequestId()
         mockPrismaCtx.prisma.backup.findFirst.mockResolvedValue(prismaBackup as Backup);
         mockPrismaCtx.prisma.backup.upsert.mockResolvedValue({} as Backup); // succeed if called, shouldn't be called
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
         expect(backupRequestSaveSpy).toBeCalledTimes(1);
         expect(backupRepoSaveSpy).not.toBeCalled();
         if (result.isErr()) {// type guard
            expect(result.error.name).toBe('DatabaseError');
            // ensure it fails in the BackupRequestRepo.save, not some other DatabaseError
            expect((result.error as DatabaseError).functionName).toBe('PrismaBackupRequestRepo.save');
         }
      });

      test('when the Backup exists, the BackupRequest is not complete, and the BackupRequest save() succeeds, it returns Ok and does not call Backup save()', async () => {
         // Arrange

         // VS Code sometimes highlights mockPrismaCtx lines as errors (circular reference) -- it is usually wrong

         mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValue(dbBackupRequest);
         mockPrismaCtx.prisma.backupRequest.upsert.mockResolvedValue({} as BackupRequest);
         const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);
         const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

         // findFirst() for getByBackupRequestId()
         mockPrismaCtx.prisma.backup.findFirst.mockResolvedValue(prismaBackup as Backup);
         mockPrismaCtx.prisma.backup.upsert.mockResolvedValue({} as Backup); // succeed if called, shouldn't be called
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
         expect(backupRepoSaveSpy).not.toBeCalled();
      });
   });
});