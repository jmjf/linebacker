import { isDate } from 'util/types';
import { Entity } from '../../common/domain/Entity';
import { Guard, GuardArgumentCollection } from '../../common/domain/Guard';
import { Result } from '../../common/domain/Result';
import { BackupProviderType } from './BackupProviderType';
import { RequestStatusType } from './RequestStatusType';
import { RequestTransportType, validRequestTransportTypes } from './RequestTransportType';

export interface IBackupRequestProps {
   backupJobId: string,
   dataDate: string | Date,
   preparedDataPathName: string,
   getOnStartFlag: boolean,
   transportTypeCode: RequestTransportType,
   backupProviderCode?: BackupProviderType,
   storagePathName?: string,
   statusTypeCode: RequestStatusType,
   receivedTimestamp: string | Date,
   checkedTimestamp?: string | Date,
   sentToInterfaceTimestamp?: string | Date,
   replyTimestamp?: string | Date,
   requesterId?: string
}

export class BackupRequest extends Entity<IBackupRequestProps> {
   public get backupRequestId(): string {
      return this._id;
   }

   public get statusTypeCode(): RequestStatusType {
      return this.props.statusTypeCode;
   }

   public get receivedTimestamp(): Date {
      return this.props.receivedTimestamp as Date;
   }

   public get checkedTimestamp(): Date {
      return this.props.checkedTimestamp as Date;
   }

   public get sentToInterfaceTimestamp(): Date {
      return this.props.sentToInterfaceTimestamp as Date;
   }

   public get replyTimestamp(): Date {
      return this.props.replyTimestamp as Date;
   }

   public get backupJobId(): string {
      return this.props.backupJobId;
   }

   public get dataDate(): Date {
      return this.props.dataDate as Date;
   }

   public get preparedDataPathName(): string {
      return this.props.preparedDataPathName;
   }

   public get getOnStartFlag(): boolean {
      return this.props.getOnStartFlag;
   }

   public get requesterId(): string | undefined {
      return this.props.requesterId;
   }

   public get transportTypeCode(): RequestTransportType {
      return this.props.transportTypeCode;
   }
   
   public get backupProviderCode() : BackupProviderType {
      return this.props.backupProviderCode as BackupProviderType;
   }

   /**
    * returns true if the `BackupRequest` has been checked to see if it is allowed
    * @returns `boolean`
    */
   public isChecked(): boolean {
      return (this.statusTypeCode && ['Allowed', 'NotAllowed'].includes(this.statusTypeCode) && isDate(this.checkedTimestamp));
   }

   /**
    * returns true if the `BackupRequest` has been sent to the backup interface
    * @returns `boolean`
    */
   public isSentToInterface(): boolean {
      return (this.statusTypeCode && this.statusTypeCode === 'Sent' && isDate(this.sentToInterfaceTimestamp));
   }

   /**
    * returns true if the `BackupRequest` has received and processed a reply from the backup interface
    * @returns `boolean`
    */
   public isReplied(): boolean {
      return (this.statusTypeCode && ['Succeeded', 'Failed'].includes(this.statusTypeCode) && isDate(this.replyTimestamp));
   }

   public setStatusSent(): void {
      this.props.statusTypeCode = 'Sent';
      this.props.sentToInterfaceTimestamp = new Date();
   }
   
   // setBackupJob()
   // setBackupProvider()
   // setStoragePath()

   private constructor(props: IBackupRequestProps, id?: string) {
      super(props, id);
   }

   /**
    * Creates an instance of `BackupRequest` for the application to use.
    * @param props properties of the backup request (excludes id)
    * @param id optional backup request id (if backup request already exists)
    * @returns `Result<BackupRequest>`
    * 
    * @remarks
    * If `create()` successfully creates the `BackupRequest` object, `result.isSuccess` is true and `result.getValue()` returns the new object.
    * If `create()` fails for any reason,  `result.isError` is true, `result.isSuccess is fales, and `result.getError()` returns the error
    */
   public static create(props:IBackupRequestProps, id?: string): Result<BackupRequest> {
      // check required props are not null or undefined
      // if result !succeeded return Result.fail<>()

      const guardArgs: GuardArgumentCollection = [
         { arg: props.backupJobId, argName: 'backupJobId' },
         { arg: props.dataDate, argName: 'dataDate' },
         { arg: props.preparedDataPathName, argName: 'preparedDataPathName' },
         { arg: props.getOnStartFlag, argName: 'getOnStartFlag' },
         { arg: props.transportTypeCode, argName: 'transportTypeCode' },
         { arg: props.statusTypeCode, argName: 'statusTypeCode' },
         { arg: props.receivedTimestamp, argName: 'receivedTimestamp' }
      ];

      const propsGuardResult = Guard.againstNullOrUndefinedBulk(guardArgs);
      if (!propsGuardResult.isSuccess) {
         return Result.fail<BackupRequest>(propsGuardResult.message);
      }

      // ensure transport type is valid
		const transportGuardResult = Guard.isOneOf(props.transportTypeCode, validRequestTransportTypes, 'transportType');
		if (!transportGuardResult.isSuccess){
			return Result.fail(transportGuardResult.message);
		}

		// ensure dataDate is a date
      const dataDateGuardResult = Guard.isValidDate(props.dataDate, 'dataDate');
		if (!dataDateGuardResult.isSuccess) {
   	   return Result.fail(dataDateGuardResult.message);
		}
      const dataDateAsDate = new Date(props.dataDate);

      // initialize props data
      const defaultValues: IBackupRequestProps = {
         ...props,
         dataDate: dataDateAsDate, // override value from props with known-good value
         backupProviderCode: props.backupProviderCode ? props.backupProviderCode : '',
         storagePathName: props.storagePathName ? props.storagePathName : '',
         requesterId: props.requesterId ? props.requesterId : '',
         // timestamps below are only set by code, so are not checked for validity
         checkedTimestamp: props.checkedTimestamp ? props.checkedTimestamp : undefined,
         sentToInterfaceTimestamp: props.sentToInterfaceTimestamp ? props.sentToInterfaceTimestamp : undefined,
         replyTimestamp: props.replyTimestamp ? props.replyTimestamp : undefined,

      };
      
      const backupRequest = new BackupRequest(defaultValues, id);

      // new requests will not have an id parameter
      // const isNewRequest = !!id === false;
      // if (isNewRequest) {
      //    // perform any special actions for new request
      // }

      return Result.succeed<BackupRequest>(backupRequest);
   }
}