import { SendRequestToInterfaceUseCase } from './SendRequestToInterfaceUseCase';
import { SendRequestToInterfaceDTO } from './SendRequestToInterfaceDTO';
import { IBackupRequestRepo } from '../../adapter/BackupRequestRepo';

describe('Send Request To Interface Use Case', () => {
   const baseDto = {
      requestId: 'test'
   } as SendRequestToInterfaceDTO;

   test('when executed with good data, it returns a "sent" BackupRequest', async () => {
      // Arrange
      const repo = {} as IBackupRequestRepo;
      const useCase = new SendRequestToInterfaceUseCase(repo);
      const dto = { ...baseDto };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isRight()).toBe(true);
   });
});