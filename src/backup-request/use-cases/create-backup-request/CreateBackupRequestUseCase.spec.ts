import { CreateBackupRequestUseCase } from './CreateBackupRequestUseCase';
import { CreateBackupRequestDTO } from './CreateBackupRequestDTO';
import { RequestTransportTypeValues } from '../../domain/RequestTransportType';
import { PrismaBackupRequestRepo } from '../../adapter/impl/PrismaBackupRequestRepo';

import { MockPrismaContext, PrismaContext, createMockPrismaContext } from '../../../common/infrastructure/database/prismaContext';
import { BackupRequest } from '@prisma/client';

describe('CreateBackupRequestUseCasePRISMA', () => {
   let mockPrismaCtx: MockPrismaContext;
   let prismaCtx: PrismaContext;

   beforeEach(() => {
      mockPrismaCtx = createMockPrismaContext();
      prismaCtx = mockPrismaCtx as unknown as PrismaContext;
    });

   const baseDto = { 
      apiVersion: '2022-01-01',
      backupJobId: 'b753d695-c9e1-4fa1-99f0-9fc025fca24c',
      dataDate: '2022-01-31',
      backupDataLocation: '/path/to/data',
      transportType: RequestTransportTypeValues.HTTP,
      getOnStartFlag: true
   } as CreateBackupRequestDTO;

   test('when executed with good data, it returns a saved backupRequest', async () => {
      // Arrange

      // The repo's save() only cares that upsert() succeeds, so the value doesn't matter
      // VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
      mockPrismaCtx.prisma.backupRequest.upsert.mockResolvedValue({} as unknown as BackupRequest);

      const repo = new PrismaBackupRequestRepo(prismaCtx);
      const saveSpy = jest.spyOn(repo, 'save');

      const useCase = new CreateBackupRequestUseCase(repo);
      const dto = { ...baseDto };
      
      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isOk()).toBe(true);
      expect(saveSpy).toHaveBeenCalledTimes(1);
      if (result.isOk()) {  // type guard so TS knows value is valid
         expect(result.value.backupJobId.value).toMatch(baseDto.backupJobId);
         expect(result.value.backupRequestId).toBeTruthy();
      };
   });

   test('when executed with an invalid transport type, it returns the expected error', async() => {
      // Arrange
      // this test fails before it calls the repo, so no need to mock upsert

      const repo = new PrismaBackupRequestRepo(prismaCtx);
      const saveSpy = jest.spyOn(repo, 'save');

      const useCase = new CreateBackupRequestUseCase(repo);
      const dto = { ...baseDto, transportType: 'BadTransport'};
      
      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isErr()).toBe(true);
      expect(saveSpy).toHaveBeenCalledTimes(0);
      if (result.isErr()) { // type guard
         expect(result.error.message).toContain('is not one of');
         expect(result.error.message).toContain('transportType');
      };
   });

   test('when executed with an undefined required value, it returns the expected error', async() => {
      // Arrange
      // this test fails before it calls the repo, so no need to mock upsert

      const repo = new PrismaBackupRequestRepo(prismaCtx);
      const saveSpy = jest.spyOn(repo, 'save');

      const useCase = new CreateBackupRequestUseCase(repo);
      // TypeScript won't let me delete dto.createOnStartFlag, so build a dto without it
      const dto = { 
         backupJobId: 'b753d695-c9e1-4fa1-99f0-9fc025fca24c',
         dataDate: '2022-01-31',
         backupDataLocation: '/path/to/data',
         transportType: RequestTransportTypeValues.HTTP
      } as CreateBackupRequestDTO;
      
      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isErr()).toBe(true);
      expect(saveSpy).toHaveBeenCalledTimes(0);
      if (result.isErr()) { // type guard
         expect(result.error.message).toContain('getOnStartFlag is null or undefined');
      };
   });

   test('when executed with an invalid dataDate, it returns the expected error', async() => {
      // Arrange
      // this test fails before it calls the repo, so no need to mock upsert

      const repo = new PrismaBackupRequestRepo(prismaCtx);
      const saveSpy = jest.spyOn(repo, 'save');
      
      const useCase = new CreateBackupRequestUseCase(repo);
      const dto = { ...baseDto, dataDate: 'invalid date'};
      
      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isErr()).toBe(true);
      expect(saveSpy).toHaveBeenCalledTimes(0);
      if (result.isErr()) { // type guard
         expect(result.error.message).toContain('not a valid date');
         expect(result.error.message).toContain('dataDate');
      }
   });
});