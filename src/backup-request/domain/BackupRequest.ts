import { isDate } from 'util/types';
import { AggregateRoot } from '../../common/domain/AggregateRoot';
import { Guard, GuardArgumentCollection } from '../../common/domain/Guard';
import { Result } from '../../common/domain/Result';
import { UniqueIdentifier } from '../../common/domain/UniqueIdentifier';
import { BackupProviderType } from './BackupProviderType';
import { BackupRequestAllowed } from './BackupRequestAllowed';
import { BackupRequestCreated } from './BackupRequestCreated';
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

export class BackupRequest extends AggregateRoot<IBackupRequestProps> {
   public get backupRequestId(): UniqueIdentifier {
      return this._id;
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

   public get transportTypeCode(): RequestTransportType {
      return this.props.transportTypeCode as RequestTransportType;
   }

   public get backupProviderCode() : BackupProviderType {
      return this.props.backupProviderCode as BackupProviderType;
   }
   public set backupProviderCode(provider: BackupProviderType) {
      this.props.backupProviderCode = provider;
   }

   public get storagePathName(): string {
      return this.props.storagePathName as string;
   }
   public set storagePathName(path: string) {
      this.props.storagePathName = path;
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
   
   public get requesterId(): string {
      return this.props.requesterId as string;
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

   public setStatusChecked(isAllowed: boolean): void {
      this.props.statusTypeCode = (isAllowed ? 'Allowed' : 'NotAllowed');
      this.props.checkedTimestamp = new Date();
      if (isAllowed) {
         this.addDomainEvent(new BackupRequestAllowed(this));
      }
   }

   private constructor(props: IBackupRequestProps, id?: UniqueIdentifier) {
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
   public static create(props:IBackupRequestProps, id?: UniqueIdentifier): Result<BackupRequest> {
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

      // I could do a similar test on status, but that would make certain tests fail before the test
      // status should be controlled by the system, so humans shouldn't be able to muck it up if they
      // don't try to meddle with the data in persistence.

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

      // new requests will have an undefined id parameter from the function call
      if (!!id === false) {
         backupRequest.addDomainEvent(new BackupRequestCreated(backupRequest));
      }

      return Result.succeed<BackupRequest>(backupRequest);
   }
}