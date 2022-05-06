import { isDate } from 'util/types';
import { Entity } from '../../common/domain/Entity';
import { Guard, GuardArgumentCollection } from '../../common/domain/Guard';
import { Result } from '../../common/domain/Result';
import { UniqueIdentifier } from '../../common/domain/UniqueIdentifier';
import { BackupResultType } from './BackupResultType';

export interface IBackupProps {
   backupRequestId: string,
   storagePathName: string,
   resultTypeCode: BackupResultType,
   backupByteCount: number,
   copyStartTimestamp: string | Date,
   copyEndTimestamp: string | Date,
   verifyStartTimestamp?: string | Date,
   verifyEndTimestamp?: string | Date,
   verifyHashText?: string
}

export class Backup extends Entity<IBackupProps> {
   public get backupId(): UniqueIdentifier {
      return this._id;
   }

   public get backupRequestId(): string {
      return this.props.backupRequestId;
   }

   public get storagePathName(): string {
      return this.props.storagePathName as string;
   }
   public set storagePathName(path: string) {
      this.props.storagePathName = path;
   }

   public get resultTypeCode(): BackupResultType {
      return this.props.resultTypeCode;
   }

   public get backupByteCount(): number {
      return this.props.backupByteCount;
   }

   public get copyStartTimestamp(): Date {
      return this.props.copyStartTimestamp as Date;
   }

   public get copyEndTimestamp(): Date {
      return this.props.copyEndTimestamp as Date;
   }

   public get verifyStartTimestamp(): Date {
      return this.props.verifyStartTimestamp as Date;
   }

   public get verifyEndTimestamp(): Date {
      return this.props.verifyEndTimestamp as Date;
   }
   
   public get verifyHashText(): string {
      return this.props.verifyHashText as string;
   }

   public isSuccess(): boolean {
      return (this.resultTypeCode && this.resultTypeCode === 'Succeeded' && isDate(this.verifyEndTimestamp));
   }

   private constructor(props: IBackupProps, id?: UniqueIdentifier) {
      super(props, id);
   }

   public static create(props: IBackupProps, id?: UniqueIdentifier): Result<Backup> {
      // check required props are not null or undefined
      // if result !succeeded return Result.fail<>()

      const guardArgs: GuardArgumentCollection = [
         { arg: props.backupRequestId, argName: 'backupRequestId' },
         { arg: props.storagePathName, argName: 'storagePathName' },
         { arg: props.resultTypeCode, argName: 'resultTypeCode' },
         { arg: props.backupByteCount, argName: 'backupByteCount' },
         { arg: props.copyStartTimestamp, argName: 'copyStartTimestamp' },
         { arg: props.copyEndTimestamp, argName: 'copyEndTimestamp' }
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
         backupRequestId: props.backupRequestId,
         storagePathName: props.storagePathName,
         resultTypeCode: props.resultTypeCode,
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