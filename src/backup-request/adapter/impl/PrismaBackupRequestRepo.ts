import { PrismaClient } from '@prisma/client';
import { BackupProviderType } from '../../../backup/domain/BackupProviderType';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';
import { err, ok, Result } from '../../../common/core/Result';
import * as DomainErrors from '../../../common/domain/DomainErrors';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';
import { BackupRequest } from '../../domain/BackupRequest';
import { RequestTransportType } from '../../domain/RequestTransportType';
import { IBackupRequestRepo } from '../BackupRequestRepo';

export class PrismaBackupRequestRepo implements IBackupRequestRepo {
   public async exists(backupRequestId: string): Promise<boolean> {
      const prisma = new PrismaClient();

      // count the number of rows that meet the condition
      const count = await prisma.backupRequest.count({
         where: {
            backupRequestId: backupRequestId
         }
      });
      
      await prisma.$disconnect();

      return (count > 0);
   }

   public async getById(backupRequestId: string): Promise<Result<BackupRequest, AdapterErrors.DatabaseError | DomainErrors.PropsError>> {
      try {
         const prisma = new PrismaClient();

         const data = await prisma.backupRequest.findUnique({
            where: {
               backupRequestId: backupRequestId
            }
         });

         await prisma.$disconnect();

         return this.mapToDomain(data);
      } catch (e) {
         return err(new AdapterErrors.DatabaseError(`${JSON.stringify(e)}`));
      }
   }

   public async save(backupRequest: BackupRequest): Promise<Result<BackupRequest, AdapterErrors.DatabaseError>> {
      console.log(`PrismaRepo called`);

      try {
         const prisma = new PrismaClient();
         console.log(`PrismaRepo client created`);

         const raw = this.mapToDb(backupRequest);
         console.log(`PrismaRepo mapped to db -- ${JSON.stringify(raw, null, 3)}`);
         const data = await prisma.backupRequest.upsert({
            where: {
               backupRequestId: raw.backupRequestId
            },
            update: {
               ...raw
            },
            create: {
               ...raw
            }
         });
         console.log(`PrismaRepo upsert called -- ${JSON.stringify(data, null, 3)}`);

         await prisma.$disconnect();
         console.log(`PrismaRepo client disconnected`);

         return ok(backupRequest);
      } catch (e) {
         console.log(`PrismaRepo caught error ${JSON.stringify(e, null, 3)}`);
         return err(new AdapterErrors.DatabaseError(`${JSON.stringify(e)}`));
      }
   }

   // this may belong in a mapper
   private mapToDomain(raw: any): Result<BackupRequest, DomainErrors.PropsError> {
      const backupRequestId = new UniqueIdentifier(raw.backupRequestId);
      const backupRequestResult = BackupRequest.create( {
         backupJobId: new UniqueIdentifier(raw.backupJobId),
         dataDate: raw.dataDate,
         preparedDataPathName: raw.preparedDataPathName,
         getOnStartFlag: raw.getOnStartFlag,
         transportTypeCode: raw.RequestTransportType as RequestTransportType,
         backupProviderCode: raw.backupProviderCode as BackupProviderType,
         storagePathName: raw.storagePathName,
         statusTypeCode: raw.statusTypeCode,
         receivedTimestamp: raw.receivedTimestamp,
         checkedTimestamp: raw.checkedTimestamp,
         sentToInterfaceTimestamp: raw.sentToInterfaceTimestamp,
         replyTimestamp: raw.replyTimestamp,
         requesterId: raw.requesterId,
         replyMessageText: raw.replyMessageText
      }, backupRequestId);
      return backupRequestResult;
   }

   private mapToDb(backupRequest: BackupRequest): any {
      return {
         backupRequestId: backupRequest.idValue,
         ...backupRequest.props,
         backupJobId: backupRequest.backupJobId.value
      };
   }
}