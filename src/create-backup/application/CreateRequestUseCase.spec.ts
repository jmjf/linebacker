import { CreateRequestUseCase } from './CreateRequestUseCase';
import { CreateRequestDTO } from './CreateRequestDTO';
import { backupRequestRepoFactory } from '../test-utils/backupRequestRepoFactory';

describe('Create Request Use Case', () => {
   test('when executed, it returns ok', async () => {
      // Arrange
      const repo = backupRequestRepoFactory();
      const useCase = new CreateRequestUseCase(repo);
      const dto = {} as CreateRequestDTO;
      
      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isRight()).toBe(true);
   });
});