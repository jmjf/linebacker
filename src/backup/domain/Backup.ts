import { dateOrUndefinedAsDate } from '../../utils/utils';

import { Guard, GuardArgumentCollection } from '../../common/core/Guard';
import { Result, ok, err } from '../../common/core/Result';
import { Entity } from '../../common/domain/Entity';
import { UniqueIdentifier } from '../../common/domain/UniqueIdentifier';
import * as DomainErrors from '../../common/domain/DomainErrors';

import { BackupProviderType } from './BackupProviderType';
import { AggregateRoot } from '../../common/domain/AggregateRoot';

export interface IBackupProps {
   backupRequestId: UniqueIdentifier,
   backupJobId: UniqueIdentifier,
   dataDate: string | Date,
   backupProviderCode: BackupProviderType,
   daysToKeepCount: number,
   dueToDeleteDate?: string | Date,
   holdFlag: boolean,
   storagePathName: string,
   backupByteCount: number,
   copyStartTimestamp: string | Date,
   copyEndTimestamp: string | Date,
   verifyStartTimestamp?: string | Date,
   verifyEndTimestamp?: string | Date,
   verifyHashText?: string
   deletedTimestamp?: string | Date
}

export class Backup extends AggregateRoot<IBackupProps> {
   public get backupId(): UniqueIdentifier {
      return this._id;
   }

   public get backupRequestId(): UniqueIdentifier {
      return this.props.backupRequestId;
   }

   public get backupJobId(): UniqueIdentifier {
      return this.props.backupJobId;
   }

   public get dataDate(): Date {
      return dateOrUndefinedAsDate(this.props.dataDate);
   }
   public set dataDate(date: Date) {
      this.props.dataDate = date;
   }

   public get backupProviderCode(): BackupProviderType {
      return this.props.backupProviderCode;
   }

   public get daysToKeepCount(): number {
      return this.props.daysToKeepCount;
   }
   public set daysToKeepCount(days: number) {
      this.props.daysToKeepCount = days;
   }

   public get dueToDeleteDate(): Date {
      return dateOrUndefinedAsDate(this.props.dueToDeleteDate);
   }
   public set dueToDeleteDate(date: Date) {
      this.props.dueToDeleteDate = date;
   }

   public get holdFlag(): boolean {
      return this.props.holdFlag;
   }
   public set holdFlag(flag: boolean) {
      this.props.holdFlag = flag;
   }

   public get storagePathName(): string {
      return this.props.storagePathName as string;
   }
   public set storagePathName(path: string) {
      this.props.storagePathName = path;
   }

   public get backupByteCount(): number {
      return this.props.backupByteCount;
   }

   public get copyStartTimestamp(): Date {
      return new Date(this.props.copyStartTimestamp);
   }

   public get copyEndTimestamp(): Date {
      return new Date(this.props.copyEndTimestamp);
   }

   public get verifyStartTimestamp(): Date | undefined {
      return dateOrUndefinedAsDate(this.props.verifyStartTimestamp);
   }

   public get verifyEndTimestamp(): Date |undefined {
      return dateOrUndefinedAsDate(this.props.verifyEndTimestamp);
   }
   
   public get verifyHashText(): string {
      return this.props.verifyHashText as string;
   }

   public get deletedTimestamp(): Date | undefined {
      return dateOrUndefinedAsDate(this.props.deletedTimestamp);
   }

   private constructor(props: IBackupProps, id?: UniqueIdentifier) {
      super(props, id);
   }

   // used in create() so must be static, which means it can't reference this.props (not static)
   public static calculateDueToDeleteDate(dataDate: Date, daysToKeepCount: number): Date {
      const deleteDate = new Date(dataDate);
      deleteDate.setDate(dataDate.getDate() + daysToKeepCount);
      return deleteDate;
   }

   public static create(props: IBackupProps, id?: UniqueIdentifier): Result<Backup, DomainErrors.PropsError> {
      // check required props are not null or undefined
      // if result !succeeded return Result.fail<>()

      const guardArgs: GuardArgumentCollection = [
         { arg: props.backupRequestId, argName: 'backupRequestId' },
         { arg: props.storagePathName, argName: 'storagePathName' },
         { arg: props.backupByteCount, argName: 'backupByteCount' },
         { arg: props.copyStartTimestamp, argName: 'copyStartTimestamp' },
         { arg: props.copyEndTimestamp, argName: 'copyEndTimestamp' },
         // for CreateBackupRecordUseCase, the following values are set based on data in the retrieved results
         // difficult to test because they'll fail BackupRequest or BackupJob create and can't set after create
         { arg: props.backupJobId, argName: 'backupJobId' },
         { arg: props.dataDate, argName: 'dataDate' },
         { arg: props.backupProviderCode, argName: 'backupProviderCode' },
         { arg: props.daysToKeepCount, argName: 'daysToKeepCount' },
         { arg: props.holdFlag, argName: 'holdFlag' }
      ];

      const propsGuardResult = Guard.againstNullOrUndefinedBulk(guardArgs);
      if (propsGuardResult.isErr()) {
         return err(new DomainErrors.PropsError(`{ message: '${propsGuardResult.error.message}'}`));;
      }

      // Guard: resultTypeCode is in the list of RequestStatusTypes
      // Guard: copy*Timestamps are dates
      
      const copyStartTimestamp = new Date(props.copyStartTimestamp);
      const copyEndTimestamp = new Date(props.copyEndTimestamp);
      
      // initialize props data
      const defaultValues: IBackupProps = {
         ...props,
         dataDate: new Date(props.dataDate),
         dueToDeleteDate: this.calculateDueToDeleteDate(new Date(props.dataDate), props.daysToKeepCount),
         storagePathName: props.storagePathName,
         backupByteCount: props.backupByteCount,
         copyStartTimestamp,
         copyEndTimestamp
      };

      // Guard: verify*Timestamp are dates -- set if valid
      // verifiedHash is not null, undefined, empty -- set if valid
      
      const backupResult = new Backup(defaultValues, id);

      // No events for this entity -- entities don't have events

      return ok(backupResult);
   }
}