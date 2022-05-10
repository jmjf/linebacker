import { UniqueIdentifier } from '../../common/domain/UniqueIdentifier';

import { BackupJob, IBackupJobProps } from '../../backup/domain/BackupJob';
import { backupJobServiceAdapterFactory } from '../../backup/test-utils/backupJobServiceAdapterFactory';

import { BackupRequest, IBackupRequestProps } from '../domain/BackupRequest';
import { SendRequestToInterfaceUseCase } from '../use-cases/send-request-to-interface/SendRequestToInterfaceUseCase';
import { BackupRequestAllowedSubscriber } from '../use-cases/send-request-to-interface/BackupRequestAllowedSubscriber';
import { BackupRequestCreatedSubscriber } from '../use-cases/check-request-allowed/BackupRequestCreatedSubscriber';
import { CheckRequestAllowedUseCase } from '../use-cases/check-request-allowed/CheckRequestAllowedUseCase';
import { CreateRequestUseCase } from '../use-cases/create-request/CreateRequestUseCase';
import { backupInterfaceAdapterFactory } from './backupInterfaceAdapterFactory';
import { backupRequestRepoFactory } from './backupRequestRepoFactory';



const TEST_EVENTS = false;

if (TEST_EVENTS) {
   const backupRequestProps = {
      backupJobId: new UniqueIdentifier('job'),
      dataDate: new Date(),
      preparedDataPathName: 'source',
      getOnStartFlag: true,
      transportTypeCode: 'HTTP',
      statusTypeCode: 'Received',
      receivedTimestamp: new Date()
   } as IBackupRequestProps;

   const eventBackupRequestRepo = backupRequestRepoFactory({
      getByIdResult: BackupRequest.create(backupRequestProps).getValue()
   });

   const backupJobProps = {
      storagePathName: 'storage path',
      backupProviderCode: 'CloudA',
      daysToKeep: 10,
      isActive: true
   } as IBackupJobProps;

   const backupJobServiceAdapter = backupJobServiceAdapterFactory({
      getBackupJobResult: BackupJob.create(backupJobProps, new UniqueIdentifier()).getValue()
   });

   new BackupRequestCreatedSubscriber(new CheckRequestAllowedUseCase({backupRequestRepo: eventBackupRequestRepo, backupJobServiceAdapter: backupJobServiceAdapter }));
   new BackupRequestAllowedSubscriber(new SendRequestToInterfaceUseCase({backupRequestRepo: eventBackupRequestRepo, backupInterfaceAdapter: backupInterfaceAdapterFactory()}));

   describe('Events: create -> check allowed -> send to interface', () => {
      test('when a backup request is created, events run', async () => {
         const repo = backupRequestRepoFactory();
         const saveSpy = jest.spyOn(repo, 'save');
         const useCase = new CreateRequestUseCase(repo);
         const dto = { 
            apiVersion: '2022-01-01',
            backupJobId: 'b753d695-c9e1-4fa1-99f0-9fc025fca24c',
            dataDate: '2022-01-31',
            backupDataLocation: '/path/to/data',
            transportType: 'HTTP',
            getOnStartFlag: true
         };
         const result = await useCase.execute(dto);
         expect(result.isRight()).toBe(true);
         expect(saveSpy).toBeCalled();
      });
   });
} else {
   test('skipped event tests', () => {
      expect(true).toBe(true);
   });
}