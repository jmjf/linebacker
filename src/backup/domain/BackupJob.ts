import { Guard, GuardArgumentCollection } from '../../common/core/Guard';
import { Result, ok, err } from '../../common/core/Result';
import { Entity } from '../../common/domain/Entity';
import { UniqueIdentifier } from '../../common/domain/UniqueIdentifier';
import * as DomainErrors from '../../common/domain/DomainErrors';

import { BackupProviderType, validBackupProviderTypes } from './BackupProviderType';

export interface IBackupJobProps {
   storagePathName: string,
   backupProviderCode: BackupProviderType,
   daysToKeep: number,
   isActive: boolean,
   holdFlag: boolean
}

export class BackupJob extends Entity<IBackupJobProps> {
   public get backupJobId(): UniqueIdentifier {
      return this._id;
   }

   public get backupProviderCode() : BackupProviderType {
      return this.props.backupProviderCode;
   }

   public get storagePathName(): string {
      return this.props.storagePathName;
   }

   public get daysToKeep(): number {
      return this.props.daysToKeep;
   }

   public get isActive(): boolean {
      return this.props.isActive;
   }

   public get holdFlag(): boolean {
      return this.props.holdFlag;
   }

   public isAllowed(): boolean {
      // using a simple rule for now, will be more complex when we have other data here
      return this.props.isActive;
   }

   // the backup controller gets backup jobs from the user interface service, so never gets a backup job without an id
   private constructor(props: IBackupJobProps, id: UniqueIdentifier) {
      super(props, id);
   }

   /**
    * Creates an instance of `BackupJob` for the application to use.
    * @param props properties of the backup request (excludes id)
    * @param id optional backup request id (if backup request already exists)
    * @returns `Result<BackupJob>`
    * 
    * @remarks
    * If `create()` successfully creates the `BackupJob` object, `result.isSuccess` is true and `result.getValue()` returns the new object.
    * If `create()` fails for any reason,  `result.isError` is true, `result.isSuccess is fales, and `result.getError()` returns the error
    */
   public static create(props:IBackupJobProps, id: UniqueIdentifier): Result<BackupJob, DomainErrors.PropsError> {
      // check required props are not null or undefined
      // if result !succeeded return Result.fail<>()

      const guardArgs: GuardArgumentCollection = [
         { arg: props.backupProviderCode, argName: 'backupProviderCode' },
         { arg: props.daysToKeep, argName: 'daysToKeep' },
         { arg: props.isActive, argName: 'isActive' },
         { arg: props.storagePathName, argName: 'storagePathName' },
         { arg: props.holdFlag, argName: 'holdFlag' }
      ];

      const propsGuardResult = Guard.againstNullOrUndefinedBulk(guardArgs);
      if (!propsGuardResult.isSuccess) {
         return err(new DomainErrors.PropsError(`{ message: '${propsGuardResult.message}'}`));
      }

      // ensure provider type is valid
		const providerGuardResult = Guard.isOneOf(props.backupProviderCode, validBackupProviderTypes, 'backupProviderType');
		if (!providerGuardResult.isSuccess){
			return err(new DomainErrors.PropsError(`{ message: '${providerGuardResult.message}'}`));
		}

      // initialize props data
      const defaultValues: IBackupJobProps = { ...props };
      
      const backupJob = new BackupJob(defaultValues, id);

      return ok(backupJob);
   }
}