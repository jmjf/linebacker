import { CreateRequestUseCase } from './CreateRequestUseCase';
import { CreateRequestDTO } from './CreateRequestDTO';
import { backupRequestRepoFactory } from '../../test-utils/backupRequestRepoFactory';
import { RequestTransportTypeValues } from '../../domain/RequestTransportType';

/**
 * See notes on testing with TypeORM in devnotes/3.1.1-RequestBackupUseCase
 */

describe('Create Request Use Case', () => {

   const baseDto = { 
      apiVersion: '2022-01-01',
      backupJobId: 'b753d695-c9e1-4fa1-99f0-9fc025fca24c',
      dataDate: '2022-01-31',
      backupDataLocation: '/path/to/data',
      transportType: RequestTransportTypeValues.HTTP,
      getOnStartFlag: true
   } as CreateRequestDTO;

   test('when executed with good data, it returns a saved backupRequest', async () => {
      // Arrange
      const repo = backupRequestRepoFactory();
      const saveSpy = jest.spyOn(repo, 'save');

      const useCase = new CreateRequestUseCase(repo);
      const dto = { ...baseDto };
      
      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isRight()).toBe(true);
      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(result.value.getValue().backupJobId).toMatch(baseDto.backupJobId);
      expect(result.value.getValue().backupRequestId).toBeTruthy();
   });

   test('when executed with an invalid transport type, it returns the expected error', async() => {
      // Arrange
      const repo = backupRequestRepoFactory();
      const saveSpy = jest.spyOn(repo, 'save');

      const useCase = new CreateRequestUseCase(repo);
      const dto = { ...baseDto, transportType: 'BadTransport'};
      
      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isLeft()).toBe(true);
      expect(result.value.error).toContain('transportType is not one of');
      expect(saveSpy).toHaveBeenCalledTimes(0);
   });

   test('when executed with an undefined required value, it returns the expected error', async() => {
      // Arrange
      const repo = backupRequestRepoFactory();
      const saveSpy = jest.spyOn(repo, 'save');

      const useCase = new CreateRequestUseCase(repo);
      // TypeScript won't let me delete dto.createOnStartFlag, so build a dto without it
      const dto = { 
         apiVersion: '2022-01-01',
         backupJobId: 'b753d695-c9e1-4fa1-99f0-9fc025fca24c',
         dataDate: '2022-01-31',
         backupDataLocation: '/path/to/data',
         transportType: RequestTransportTypeValues.HTTP
      } as CreateRequestDTO;
      
      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isLeft()).toBe(true);
      expect(result.value.error).toContain('getOnStartFlag is null or undefined');
      expect(saveSpy).toHaveBeenCalledTimes(0);
   });

   test('when executed with an invalid dataDate, it returns the expected error', async() => {
      // Arrange
      const repo = backupRequestRepoFactory();
      const saveSpy = jest.spyOn(repo, 'save');
      
      const useCase = new CreateRequestUseCase(repo);
      const dto = { ...baseDto, dataDate: 'invalid date'};
      
      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isLeft()).toBe(true);
      expect(result.value.error).toContain('dataDate is not a valid date');
      expect(saveSpy).toHaveBeenCalledTimes(0);
   });
});