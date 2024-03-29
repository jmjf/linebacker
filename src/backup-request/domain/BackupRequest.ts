import { dateOrUndefinedAsDate } from '../../common/utils/utils';

import { isDate } from 'util/types';
import { AggregateRoot } from '../../common/domain/AggregateRoot';
import { Guard, GuardArgumentCollection } from '../../common/core/Guard';
import { err, ok, Result } from '../../common/core/Result';
import { UniqueIdentifier } from '../../common/domain/UniqueIdentifier';
import * as DomainErrors from '../../common/domain/DomainErrors';

import { BackupProviderType } from '../../backup-job/domain/BackupProviderType';

import { BackupRequestAllowed } from './BackupRequestAllowed.event';
import { BackupRequestCreated } from './BackupRequestCreated.event';
import { StoreResultType } from './StoreResultType';
import { BackupRequestStatusType, BackupRequestStatusTypeValues } from './BackupRequestStatusType';
import { RequestTransportType, validRequestTransportTypes } from './RequestTransportType';
import { BackupRequestReceived } from './BackupRequestReceived.event';

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);

export interface IBackupRequestProps {
	// allow it to accept a string and convert to a UniqueIdentifier if good
	backupJobId: string | UniqueIdentifier;
	dataDate: string | Date;
	preparedDataPathName: string;
	getOnStartFlag: boolean;
	transportTypeCode: RequestTransportType;
	backupProviderCode?: BackupProviderType;
	storagePathName?: string;
	statusTypeCode: BackupRequestStatusType;
	acceptedTimestamp?: string | Date;
	receivedTimestamp?: string | Date;
	checkedTimestamp?: string | Date;
	sentToInterfaceTimestamp?: string | Date;
	replyTimestamp?: string | Date;
	requesterId?: string;
	replyMessageText?: string;
}

export class BackupRequest extends AggregateRoot<IBackupRequestProps> {
	public get backupRequestId(): UniqueIdentifier {
		return this._id;
	}

	public get backupJobId(): UniqueIdentifier {
		return this.props.backupJobId as UniqueIdentifier;
	}

	public get dataDate(): Date {
		return dateOrUndefinedAsDate(this.props.dataDate);
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

	public get backupProviderCode(): BackupProviderType {
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

	public get statusTypeCode(): BackupRequestStatusType {
		return this.props.statusTypeCode;
	}

	public get acceptedTimestamp(): Date {
		return dateOrUndefinedAsDate(this.props.acceptedTimestamp);
	}

	public get receivedTimestamp(): Date {
		return dateOrUndefinedAsDate(this.props.receivedTimestamp);
	}

	public get checkedTimestamp(): Date {
		return dateOrUndefinedAsDate(this.props.checkedTimestamp);
	}

	public get sentToInterfaceTimestamp(): Date {
		return dateOrUndefinedAsDate(this.props.sentToInterfaceTimestamp);
	}

	public get replyTimestamp(): Date {
		return dateOrUndefinedAsDate(this.props.replyTimestamp);
	}

	public get requesterId(): string {
		return this.props.requesterId as string;
	}

	public get replyMessageText(): string {
		return this.props.replyMessageText as string;
	}

	public isReceived(): boolean {
		return this.props.statusTypeCode === 'Received' && isDate(this.receivedTimestamp);
	}

	/**
	 * returns true if the `BackupRequest` has been checked to see if it is allowed
	 * @returns `boolean`
	 */
	public isChecked(): boolean {
		return (
			this.statusTypeCode &&
			(this.statusTypeCode === BackupRequestStatusTypeValues.Allowed ||
				this.statusTypeCode === BackupRequestStatusTypeValues.NotAllowed) &&
			isDate(this.checkedTimestamp)
		);
	}

	public isAllowed(): boolean {
		return this.props.statusTypeCode === 'Allowed' && isDate(this.checkedTimestamp);
	}

	/**
	 * returns true if the `BackupRequest` has been sent to the backup interface
	 * @returns `boolean`
	 */
	public isSentToInterface(): boolean {
		return (
			this.statusTypeCode &&
			this.statusTypeCode === BackupRequestStatusTypeValues.Sent &&
			isDate(this.sentToInterfaceTimestamp)
		);
	}

	/**
	 * returns true if the `BackupRequest` is in a Succeeded or failed status
	 * @returns `boolean`
	 */
	public isReplied(): boolean {
		return this.isFailed() || this.isSucceeded();
	}

	/**
	 * returns true if the `BackupRequest` is in a Failed status
	 * @returns `boolean`
	 */
	public isFailed(): boolean {
		return (
			this.statusTypeCode &&
			this.statusTypeCode === BackupRequestStatusTypeValues.Failed &&
			isDate(this.replyTimestamp)
		);
	}

	/**
	 * returns true if the `BackupRequest` is in a Succeeded status
	 * @returns `boolean`
	 */
	public isSucceeded(): boolean {
		return (
			this.statusTypeCode &&
			this.statusTypeCode === BackupRequestStatusTypeValues.Succeeded &&
			isDate(this.replyTimestamp)
		);
	}

	public setStatusReceived(): void {
		this.props.statusTypeCode = BackupRequestStatusTypeValues.Received;
		this.props.receivedTimestamp = new Date();
		this.addEvent(new BackupRequestReceived(this));
	}

	public setStatusSent(): void {
		this.props.statusTypeCode = BackupRequestStatusTypeValues.Sent;
		this.props.sentToInterfaceTimestamp = new Date();
	}

	public setStatusChecked(isAllowed: boolean): void {
		this.props.statusTypeCode = isAllowed
			? BackupRequestStatusTypeValues.Allowed
			: BackupRequestStatusTypeValues.NotAllowed;
		this.props.checkedTimestamp = new Date();
		if (isAllowed) {
			this.addEvent(new BackupRequestAllowed(this));
		}
	}

	public setStatusReplied(status: StoreResultType, message?: string): void {
		this.props.statusTypeCode = status;
		this.props.replyMessageText = message ? message : '';
		this.props.replyTimestamp = new Date();
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
	public static create(
		props: IBackupRequestProps,
		id?: UniqueIdentifier
	): Result<BackupRequest, DomainErrors.PropsError> {
		const functionName = 'create';
		// check required props are not null or undefined
		// if result !succeeded return Result.fail<>()

		const guardArgs: GuardArgumentCollection = [
			{ arg: props.backupJobId, argName: 'backupJobId' },
			{ arg: props.dataDate, argName: 'dataDate' },
			{ arg: props.preparedDataPathName, argName: 'preparedDataPathName' },
			{ arg: props.getOnStartFlag, argName: 'getOnStartFlag' },
			{ arg: props.transportTypeCode, argName: 'transportTypeCode' },
			{ arg: props.statusTypeCode, argName: 'statusTypeCode' },
		];

		const propsGuardResult = Guard.againstNullOrUndefinedBulk(guardArgs);
		if (propsGuardResult.isErr()) {
			return err(
				new DomainErrors.PropsError(propsGuardResult.error.message, {
					argName: propsGuardResult.error.argName,
					moduleName,
					functionName,
				})
			);
		}

		// ensure transport type is valid
		const transportGuardResult = Guard.isOneOf(props.transportTypeCode, validRequestTransportTypes, 'transportType');
		if (transportGuardResult.isErr()) {
			return err(
				new DomainErrors.PropsError(transportGuardResult.error.message, {
					argName: transportGuardResult.error.argName,
					moduleName,
					functionName,
				})
			);
		}

		// I could do a similar test on status, but that would make certain tests fail before the test
		// status should be controlled by the system, so humans shouldn't be able to muck it up if they
		// don't try to meddle with the data in persistence.

		// ensure dataDate is a date
		const dataDateGuardResult = Guard.isValidDate(props.dataDate, 'dataDate');
		if (dataDateGuardResult.isErr()) {
			return err(
				new DomainErrors.PropsError(dataDateGuardResult.error.message, {
					argName: dataDateGuardResult.error.argName,
					moduleName,
					functionName,
				})
			);
		}

		const dataDateAsDate = new Date(props.dataDate);
		// ensure backupJobIdentifier is a UniqueIdentifier
		props.backupJobId =
			typeof props.backupJobId === 'string' ? new UniqueIdentifier(props.backupJobId) : props.backupJobId;

		// initialize props data
		const defaultValues: IBackupRequestProps = {
			...props,
			dataDate: dataDateAsDate, // override value from props with known-good value
			backupProviderCode: props.backupProviderCode ? props.backupProviderCode : '',
			storagePathName: props.storagePathName ? props.storagePathName : '',
			requesterId: props.requesterId ? props.requesterId : '',
			// timestamps below are only set by code, so are not checked for validity
			acceptedTimestamp: dateOrUndefinedAsDate(props.acceptedTimestamp),
			receivedTimestamp: dateOrUndefinedAsDate(props.receivedTimestamp),
			checkedTimestamp: dateOrUndefinedAsDate(props.checkedTimestamp),
			sentToInterfaceTimestamp: dateOrUndefinedAsDate(props.sentToInterfaceTimestamp),
			replyTimestamp: dateOrUndefinedAsDate(props.replyTimestamp),
		};

		const backupRequest = new BackupRequest(defaultValues, id);

		// new requests will have an undefined id parameter from the function call
		if (!!id === false) {
			backupRequest.addEvent(new BackupRequestCreated(backupRequest));
		}

		return ok(backupRequest);
	}
}
