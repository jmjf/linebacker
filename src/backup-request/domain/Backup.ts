import { isDate } from 'util/types';
import { Entity } from '../../common/domain/Entity';
import { Guard, GuardArgumentCollection } from '../../common/domain/Guard';
import { Result } from '../../common/domain/Result';
import { UniqueIdentifier } from '../../common/domain/UniqueIdentifier';
import { BackupResultType } from './BackupResultType';

export interface IBackupProps {
   backupRequestId: string,
   backupJobId: string,
   dataDate: string | Date,
   backupProviderCode: string,
   daysToKeepCount: number,
   deleteDate?: string | Date,
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

export class Backup extends Entity<IBackupProps> {
   public get backupId(): UniqueIdentifier {
      return this._id;
   }

   public get backupRequestId(): string {
      return this.props.backupRequestId;
   }

   public get backupJobId(): string {
      return this.props.backupJobId;
   }

   public get dataDate(): Date {
      return new Date(this.props.dataDate);
   }
   public set dataDate(date: Date) {
      this.props.dataDate = date;
   }

   public get backupProviderCode(): string {
      return this.props.backupProviderCode;
   }

   public get daysToKeepCount(): number {
      return this.props.daysToKeepCount;
   }
   public set daysToKeepCount(days: number) {
      this.props.daysToKeepCount = days;
   }

   public get deleteDate(): Date {
      return (typeof this.props.deleteDate === 'undefined') 
         ? undefined as unknown as Date
         : new Date(this.props.deleteDate);
   }
   public set deleteDate(date: Date) {
      this.props.deleteDate = date;
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
      return typeof this.props.verifyStartTimestamp === 'undefined'
         ? undefined
         : new Date(this.props.verifyStartTimestamp);
   }

   public get verifyEndTimestamp(): Date |undefined {
      return typeof this.props.verifyEndTimestamp === 'undefined'
         ? undefined
         : new Date(this.props.verifyEndTimestamp);
   }
   
   public get verifyHashText(): string {
      return this.props.verifyHashText as string;
   }

   public get deletedTimestamp(): Date | undefined {
      return typeof this.props.deletedTimestamp === 'undefined'
      ? undefined
      : new Date(this.props.deletedTimestamp);
   }

   private constructor(props: IBackupProps, id?: UniqueIdentifier) {
      super(props, id);
   }

   // used in create() so must be static, which means it can't reference this.props (not static)
   public static calculateDeleteDate(dataDate: Date, daysToKeepCount: number): Date {
      const deleteDate = new Date(dataDate);
      deleteDate.setDate(dataDate.getDate() + daysToKeepCount);
      return deleteDate;
   }

   public static create(props: IBackupProps, id?: UniqueIdentifier): Result<Backup> {
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
      if (!propsGuardResult.isSuccess) {
         return Result.fail<Backup>(propsGuardResult.message);
      }

      // Guard: resultTypeCode is in the list of RequestStatusTypes
      // Guard: copy*Timestamps are dates
      
      const copyStartTimestamp = new Date(props.copyStartTimestamp);
      const copyEndTimestamp = new Date(props.copyEndTimestamp);
      
      // initialize props data
      const defaultValues: IBackupProps = {
         ...props,
         dataDate: new Date(props.dataDate),
         deleteDate: this.calculateDeleteDate(new Date(props.dataDate), props.daysToKeepCount),
         storagePathName: props.storagePathName,
         backupByteCount: props.backupByteCount,
         copyStartTimestamp,
         copyEndTimestamp
      };

      // Guard: verify*Timestamp are dates -- set if valid
      // verifiedHash is not null, undefined, empty -- set if valid
      
      const backupResult = new Backup(defaultValues, id);

      // No events for this entity -- entities don't have events

      return Result.succeed<Backup>(backupResult);
   }
}