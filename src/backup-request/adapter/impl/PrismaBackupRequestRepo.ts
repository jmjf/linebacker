import { PrismaContext } from '../../../common/infrastructure/database/prismaContext';

import * as AdapterErrors from '../../../common/adapter/AdapterErrors';
import { err, ok, Result } from '../../../common/core/Result';
import * as DomainErrors from '../../../common/domain/DomainErrors';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';

import { BackupProviderType } from '../../../backup/domain/BackupProviderType';

import { BackupRequest } from '../../domain/BackupRequest';
import { RequestTransportType } from '../../domain/RequestTransportType';
import { IBackupRequestRepo } from '../BackupRequestRepo';

export class PrismaBackupRequestRepo implements IBackupRequestRepo {
   private prisma;

   constructor(ctx: PrismaContext) {
      this.prisma = ctx.prisma;   
   }

   public async exists(backupRequestId: string): Promise<boolean> {
      // count the number of rows that meet the condition
      const count = await this.prisma.backupRequest.count({
         where: {
            backupRequestId: backupRequestId
         }
      });
      
      return (count > 0);
   }

   public async getById(backupRequestId: string): Promise<Result<BackupRequest, AdapterErrors.DatabaseError | DomainErrors.PropsError>> {
      try {
         const data = await this.prisma.backupRequest.findUnique({
            where: {
               backupRequestId: backupRequestId
            }
         });

         return this.mapToDomain(data);
      } catch (e) {
         return err(new AdapterErrors.DatabaseError(`${JSON.stringify(e)}`));
      }
   }

   public async save(backupRequest: BackupRequest): Promise<Result<BackupRequest, AdapterErrors.DatabaseError>> {
      const raw = this.mapToDb(backupRequest);
      
      try {
         await this.prisma.backupRequest.upsert({
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
      } catch (e) {
         return err(new AdapterErrors.DatabaseError(`${JSON.stringify(e)}`));
      };

      // The application enforces the business rules, not the database.
      // Under no circumstances should the database change the data it gets.
      // Returning the backup request allows use cases to return the result of save() if they can't do anything about a DatabaseError.
      return ok(backupRequest);
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