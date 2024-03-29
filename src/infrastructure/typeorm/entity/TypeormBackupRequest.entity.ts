import { Column, Entity } from 'typeorm';

@Entity({ name: 'BackupRequest' })
export class TypeormBackupRequest {
	@Column({
		name: 'BackupRequestIdentifier',
		type: 'varchar',
		length: 50,
		primary: true,
		unique: true,
		nullable: false,
	})
	backupRequestId: string;

	@Column({ name: 'BackupJobIdentifier', type: 'varchar', length: 50, nullable: false })
	backupJobId: string;

	@Column({ name: 'DataDate', type: 'datetimeoffset', nullable: false })
	dataDate: Date;

	@Column({ name: 'PreparedDataPathName', type: 'varchar', length: 250, nullable: false })
	preparedDataPathName: string;

	@Column({ name: 'GetOnStartFlag', type: 'bit', nullable: false })
	getOnStartFlag: boolean;

	@Column({ name: 'TransportTypeCode', type: 'varchar', length: 50, nullable: false })
	transportTypeCode: string;

	@Column({ name: 'BackupProviderCode', type: 'varchar', length: 50, nullable: true })
	backupProviderCode: string | null | undefined;

	@Column({ name: 'StoragePathName', type: 'varchar', length: 250, nullable: true })
	storagePathName: string | null | undefined;

	@Column({ name: 'StatusTypeCode', type: 'varchar', length: 50, nullable: false })
	statusTypeCode: string;

	@Column({ name: 'AcceptedTimestamp', type: 'datetimeoffset', nullable: true })
	acceptedTimestamp: Date | null | undefined;

	@Column({ name: 'ReceivedTimestamp', type: 'datetimeoffset', nullable: true })
	receivedTimestamp: Date | null | undefined;

	@Column({ name: 'CheckedTimestamp', type: 'datetimeoffset', nullable: true })
	checkedTimestamp: Date | null | undefined;

	@Column({ name: 'SentToInterfaceTimestamp', type: 'datetimeoffset', nullable: true })
	sentToInterfaceTimestamp: Date | null | undefined;

	@Column({ name: 'ReplyTimestamp', type: 'datetimeoffset', nullable: true })
	replyTimestamp: Date | null | undefined;

	@Column({ name: 'RequesterIdentifier', type: 'varchar', length: 50, nullable: true })
	requesterId: string | null | undefined;

	@Column({ name: 'ReplyMessageText', type: 'varchar', length: 250, nullable: true })
	replyMessageText: string | null | undefined;
}
