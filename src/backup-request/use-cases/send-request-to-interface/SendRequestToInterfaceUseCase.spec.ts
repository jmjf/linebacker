import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';

import { BackupRequest, IBackupRequestProps } from '../../domain/BackupRequest';
import { RequestTransportTypeValues } from '../../domain/RequestTransportType';
import { RequestStatusTypeValues } from '../../domain/RequestStatusType';
import { backupInterfaceAdapterFactory } from '../../test-utils/backupInterfaceAdapterFactory';
import { backupRequestRepoFactory } from '../../test-utils/backupRequestRepoFactory';

import { SendRequestToInterfaceUseCase } from './SendRequestToInterfaceUseCase';
import { SendRequestToInterfaceDTO } from './SendRequestToInterfaceDTO';


describe('Send Request To Interface Use Case', () => {
   const baseDto = {
      backupRequestId: 'testRequest'
   } as SendRequestToInterfaceDTO;

   const backupRequestProps = {
      backupJobId: new UniqueIdentifier('job'), // set in test Arrange phase to support logging if needed
      dataDate: new Date(),
      preparedDataPathName: 'path',
      getOnStartFlag: true,
      transportTypeCode: RequestTransportTypeValues.HTTP,
      statusTypeCode: RequestStatusTypeValues.Allowed,
      receivedTimestamp: new Date(),
      checkedTimestamp: new Date()      
   } as IBackupRequestProps;

   test('when request is Allowed, it returns a BackupRequest in Sent status', async () => {
      // Arrange
      const startTimestamp = new Date();

      const resultBackupRequest = BackupRequest.create(
         {
            ...backupRequestProps,
            backupJobId: new UniqueIdentifier('request Allowed')
         }).getValue();
      const repo = backupRequestRepoFactory({getByIdResult: resultBackupRequest});

      const adapter = backupInterfaceAdapterFactory({sendMessageResult: true});
      
      const useCase = new SendRequestToInterfaceUseCase({backupRequestRepo: repo, backupInterfaceAdapter: adapter});
      const dto = { ...baseDto };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isRight()).toBe(true);
      expect(result.value.getValue().statusTypeCode).toBe(RequestStatusTypeValues.Sent);
      expect(result.value.getValue().sentToInterfaceTimestamp.valueOf()).toBeGreaterThan(startTimestamp.valueOf());
   });

   test.each([
      { status: RequestStatusTypeValues.Sent, timestampName: 'sentToInterfaceTimestamp' },
      { status: RequestStatusTypeValues.Failed, timestampName: 'replyTimestamp' },
      { status: RequestStatusTypeValues.Succeeded, timestampName: 'replyTimestamp' }
   ])('when request is $status, it returns a BackupRequest in $status status with $timestampName unchanged', async ({status, timestampName}) => {
      // Arrange
      const resultBackupRequest = BackupRequest.create(
         {
            ...backupRequestProps,
            backupJobId: new UniqueIdentifier('request is Sent'),
            statusTypeCode: status,
            sentToInterfaceTimestamp: new Date('2001-01-01'),
            replyTimestamp: new Date('2002-02-02')
         }
      ).getValue();
      const expectedTimestamp = new Date((resultBackupRequest as {[index: string]:any})[timestampName]); // ensure we have a separate instance
      const repo = backupRequestRepoFactory({getByIdResult: resultBackupRequest});

      const adapter = backupInterfaceAdapterFactory({sendMessageResult: true});

      const useCase = new SendRequestToInterfaceUseCase({backupRequestRepo: repo, backupInterfaceAdapter: adapter});
      const dto = { ...baseDto };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isRight()).toBe(true);
      expect(result.value.getValue().statusTypeCode).toBe(status);
      expect(result.value.getValue()[timestampName].valueOf()).toBe(expectedTimestamp.valueOf());
   });

   test('when request does not exist, it returns failure', async () => {
      // Arrange
      const repo = backupRequestRepoFactory();

      const adapter = backupInterfaceAdapterFactory({sendMessageResult: true});

      const useCase = new SendRequestToInterfaceUseCase({backupRequestRepo: repo, backupInterfaceAdapter: adapter});
      const dto = { ...baseDto };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isLeft()).toBe(true);
   });

   test('when request is in NotAllowed status, it returns failure', async () => {
      // Arrange
      const resultBackupRequest = BackupRequest.create(
         {
            ...backupRequestProps,
            backupJobId: new UniqueIdentifier('request NotAllowed'),
            statusTypeCode: 'NotAllowed'
         }
      ).getValue();
      const repo = backupRequestRepoFactory({getByIdResult: resultBackupRequest});

      const adapter = backupInterfaceAdapterFactory({sendMessageResult: true});

      const useCase = new SendRequestToInterfaceUseCase({backupRequestRepo: repo, backupInterfaceAdapter: adapter});
      const dto = { ...baseDto };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isLeft()).toBe(true);
   });

   test('when send message fails, it returns failure', async () => {
      // Arrange
      const resultBackupRequest = BackupRequest.create(
         {
            ...backupRequestProps,
            backupJobId: new UniqueIdentifier('sendMessage fails')
         }
      ).getValue();
      const repo = backupRequestRepoFactory({getByIdResult: resultBackupRequest});

      const adapter = backupInterfaceAdapterFactory({sendMessageResult: false});
      
      const useCase = new SendRequestToInterfaceUseCase({backupRequestRepo: repo, backupInterfaceAdapter: adapter});
      const dto = { ...baseDto };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isLeft()).toBe(true);
   });

   test('when backup request is not found, it returns failure with error message "not found"', async () => {
      // Arrange
      const repo = backupRequestRepoFactory();

      const adapter = backupInterfaceAdapterFactory({sendMessageResult: false});

      const useCase = new SendRequestToInterfaceUseCase({backupRequestRepo: repo, backupInterfaceAdapter: adapter});
      const dto = { ...baseDto };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isLeft()).toBe(true);
      expect(result.value.errorValue()).toMatch('not found');
   });
});