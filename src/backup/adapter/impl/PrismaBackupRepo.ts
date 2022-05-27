import { PrismaContext } from '../../../common/infrastructure/database/prismaContext';

import { DomainEventBus } from '../../../common/domain/DomainEventBus';

import * as AdapterErrors from '../../../common/adapter/AdapterErrors';
import { err, ok, Result } from '../../../common/core/Result';
import * as DomainErrors from '../../../common/domain/DomainErrors';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';

import { BackupProviderType } from '../../../backup/domain/BackupProviderType';

import { Backup } from '../../domain/Backup';
import { RequestTransportType } from '../../../backup-request/domain/RequestTransportType';
import { IBackupRepo } from '../BackupRepo';

export class PrismaBackupRepo implements IBackupRepo {
   private prisma;

   constructor(ctx: PrismaContext) {
      this.prisma = ctx.prisma;   
   }

   public async exists(backupId: string): Promise<Result<boolean, AdapterErrors.DatabaseError>> {
      // count the number of rows that meet the condition
      try {
         const count = await this.prisma.backup.count({
            where: {
               backupId: backupId
            }
         });
      
         return ok(count > 0);
      } catch (e) {
         return err(new AdapterErrors.DatabaseError(`${JSON.stringify(e)}`));
      }
   }

   public async getById(backupId: string): Promise<Result<Backup, 
      AdapterErrors.DatabaseError
      | AdapterErrors.NotFoundError
      | DomainErrors.PropsError>> 
   {
      try {
         const data = await this.prisma.backup.findUnique({
            where: {
               backupId: backupId
            }
         });

         if (data === null) {
            return err(new AdapterErrors.NotFoundError(`Backup not found |${backupId}|`));
         }

         return this.mapToDomain(data);
      } catch (e) {
         return err(new AdapterErrors.DatabaseError(`${JSON.stringify(e)}`));
      }
   }

   public async save(backup: Backup): Promise<Result<Backup, AdapterErrors.DatabaseError>> {
      const raw = this.mapToDb(backup);
      
      try {
         await this.prisma.backup.upsert({
            where: {
               backupId: raw.backupId
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

      // trigger domain events
      DomainEventBus.publishEventsForAggregate(backup.id);

      // The application enforces the business rules, not the database.
      // Under no circumstances should the database change the data it gets.
      // Returning the backup request allows use cases to return the result of save() if they can't do anything about a DatabaseError.
      return ok(backup);
   }

   // this may belong in a mapper
   private mapToDomain(raw: any): Result<Backup, DomainErrors.PropsError> {
      const backupId = new UniqueIdentifier(raw.backupId);
      const backupResult = Backup.create( {
         backupRequestId: new UniqueIdentifier(raw.backupRequestId),
         backupJobId: new UniqueIdentifier(raw.backupJobId),
         dataDate: raw.dataDate,
         backupProviderCode: raw.backupProviderCode as BackupProviderType,
         storagePathName: raw.storagePathName,
         daysToKeepCount: raw.daysToKeepCount,
         holdFlag: raw.holdFlag,
         backupByteCount: raw.backupByteCount,
         copyStartTimestamp: raw.copyStartTimestamp,
         copyEndTimestamp: raw.copyEndTimestamp,
         verifyStartTimestamp: raw.verifyStartTimestamp,
         verifyEndTimestamp: raw.verifyEndTimestamp,
         verifyHashText: raw.verifyHashText,
         dueToDeleteDate: raw.dueToDeleteDate,
         deletedTimestamp: raw.deletedTimestamp
      }, backupId);
      return backupResult;
   }


   private mapToDb(backup: Backup): any {
      return {
         backupId: backup.idValue,
         ...backup.props,
         backupRequestId: backup.backupRequestId.value,
         backupJobId: backup.backupJobId.value
      };
   }
}