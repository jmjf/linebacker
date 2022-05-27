import { UniqueIdentifier } from '../../common/domain/UniqueIdentifier';

import { RequestTransportTypeValues } from '../domain/RequestTransportType';
import { RequestStatusTypeValues } from '../domain/RequestStatusType';

import { BackupJob, IBackupJobProps } from '../../backup/domain/BackupJob';
import { backupJobServiceAdapterFactory } from '../../backup/test-utils/backupJobServiceAdapterFactory';

import { SendRequestToInterfaceUseCase } from '../use-cases/send-request-to-interface/SendRequestToInterfaceUseCase';
import { BackupRequestAllowedSubscriber } from '../use-cases/send-request-to-interface/BackupRequestAllowedSubscriber';

import { BackupRequestCreatedSubscriber } from '../use-cases/check-request-allowed/BackupRequestCreatedSubscriber';
import { CheckRequestAllowedUseCase } from '../use-cases/check-request-allowed/CheckRequestAllowedUseCase';

import { CreateBackupRequestUseCase } from '../use-cases/create-backup-request/CreateBackupRequestUseCase';

import { backupInterfaceAdapterFactory } from './backupInterfaceAdapterFactory';

import { MockPrismaContext, PrismaContext, createMockPrismaContext } from '../../common/infrastructure/database/prismaContext';
import { BackupRequest } from '@prisma/client';
import { PrismaBackupRequestRepo } from '../adapter/impl/PrismaBackupRequestRepo';

const TEST_EVENTS = false;

if (TEST_EVENTS) {

   describe('Events: create -> check allowed -> send to interface', () => {
      let mockPrismaCtx: MockPrismaContext;
      let prismaCtx: PrismaContext;
   
      beforeEach(() => {
         mockPrismaCtx = createMockPrismaContext();
         prismaCtx = mockPrismaCtx as unknown as PrismaContext;
       });

      const dbBackupRequest: BackupRequest = {
         backupRequestId: 'dbBackupRequestId',
         backupJobId: 'dbBackupJobId',
         dataDate: new Date(),
         preparedDataPathName: 'db/prepared/data/path/name',
         getOnStartFlag: true,
         transportTypeCode: RequestTransportTypeValues .HTTP,
         statusTypeCode: RequestStatusTypeValues.Received,
         receivedTimestamp: new Date(),
         requesterId: 'dbRequesterId',
         backupProviderCode: null,
         checkedTimestamp: null,
         storagePathName: null,
         sentToInterfaceTimestamp: null,
         replyTimestamp: null,
         replyMessageText: null      
      };
   
      const backupJobProps = {
         storagePathName: 'storage path',
         backupProviderCode: 'CloudA',
         daysToKeep: 10,
         isActive: true,
         holdFlag: false
      } as IBackupJobProps;

      const resultBackupJob = BackupJob.create(backupJobProps, new UniqueIdentifier());
      if (resultBackupJob.isErr()) {
         console.log('create BackupJob failed', JSON.stringify(resultBackupJob.error, null, 4));
         return;
      }
   
      const backupJobServiceAdapter = backupJobServiceAdapterFactory({
         getBackupJobResult: resultBackupJob.unwrapOr({} as BackupJob)
      });

      test('when a backup request is created, events run', async () => {
         // Arrange
         
         // VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
         mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValue(dbBackupRequest); // default after responses below
         mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValueOnce(dbBackupRequest); // first response -- for check allowed
         mockPrismaCtx.prisma.backupRequest.findUnique.mockResolvedValueOnce({ 
            ...dbBackupRequest,
            statusTypeCode: RequestStatusTypeValues.Allowed
         }); // second reponse -- for send to interface

         // save() just needs to succeed; result value doesn't affect outcome
         mockPrismaCtx.prisma.backupRequest.upsert.mockResolvedValue({} as unknown as BackupRequest);

         const repo = new PrismaBackupRequestRepo(prismaCtx);
         const saveSpy = jest.spyOn(repo, 'save');
   
         new BackupRequestCreatedSubscriber(new CheckRequestAllowedUseCase({backupRequestRepo: repo, backupJobServiceAdapter: backupJobServiceAdapter }));
         new BackupRequestAllowedSubscriber(new SendRequestToInterfaceUseCase({backupRequestRepo: repo, backupInterfaceAdapter: backupInterfaceAdapterFactory()}));
   
         const useCase = new CreateBackupRequestUseCase(repo);
         const dto = { 
            apiVersion: '2022-01-01',
            backupJobId: 'b753d695-c9e1-4fa1-99f0-9fc025fca24c',
            dataDate: '2022-01-31',
            backupDataLocation: '/path/to/data',
            transportType: 'HTTP',
            getOnStartFlag: true
         };

         // Act
         const result = await useCase.execute(dto);
         // give events time to run before continuing
         await (()=>new Promise((resolve) => setTimeout(resolve, 1000)))();

         // Assert
         expect(result.isOk()).toBe(true);
         expect(saveSpy).toBeCalled();
         
         console.log(
            ' *'.repeat(35), '\n',
            ' *'.repeat(35), '\n',
            ' *'.repeat(35), '\n',
            '***** Check output from event runs to ensure all events ran *****', '\n',
            ' *'.repeat(35), '\n',
            ' *'.repeat(35), '\n',
            ' *'.repeat(35), '\n'
         );

      });
   });
} else {
   test('skipped event tests', () => {
      console.log(
         ' *'.repeat(35), '\n',
         ' *'.repeat(35), '\n',
         '***** skipped event tests *****', '\n',
         ' *'.repeat(35), '\n',
         ' *'.repeat(35), '\n'
      );
      expect(true).toBe(true);
   });
}