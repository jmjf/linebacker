import { CreateBackupRequestUseCase } from './CreateBackupRequestUseCase';
import { CreateBackupRequestDTO } from './CreateBackupRequestDTO';
import { backupRequestRepoFactory } from '../../test-utils/backupRequestRepoFactory';
import { RequestTransportTypeValues } from '../../domain/RequestTransportType';

/**
 * See notes on testing with TypeORM in devnotes/3.1.1-RequestBackupUseCase
 */

describe('CreateBackupRequestUseCase', () => {

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
      const repo = backupRequestRepoFactory();
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
      const repo = backupRequestRepoFactory();
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
      const repo = backupRequestRepoFactory();
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
      const repo = backupRequestRepoFactory();
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