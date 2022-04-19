import { CreateRequestUseCase } from '../CreateRequestUseCase';
import { CreateRequestDTO } from '../CreateRequestDTO';
import { IBackupRequestRepo } from '../../adapter/BackupRequestRepo';
import { BackupRequest } from '../../domain/BackupRequest';

/**
 * See notes on testing with TypeORM in devnotes/3.1.1-RequestBackupUseCase
 */

describe('Create Request Use Case', () => {
   test('when executed, it returns ok', async () => {
      // Arrange
      const repo = {} as IBackupRequestRepo;
      const useCase = new CreateRequestUseCase(repo);
      const dto = {} as CreateRequestDTO;
      
      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isRight()).toBe(true);
   });
});