import { Column, Entity } from 'typeorm';

@Entity({ name: 'Backup' })
export class TypeormBackup {
	@Column({
		name: 'BackupIdentifier',
		type: 'varchar',
		length: 50,
		primary: true,
		unique: true,
		nullable: false,
	})
	backupId: string;

	@Column({ name: 'BackupRequestIdentifier', type: 'varchar', length: 50, nullable: false })
	backupRequestId: string;

	@Column({ name: 'BackupJobIdentifier', type: 'varchar', length: 50, nullable: false })
	backupJobId: string;

	@Column({ name: 'DataDate', type: 'datetime2', nullable: false })
	dataDate: Date;

	@Column({ name: 'StoragePathName', type: 'varchar', length: 250, nullable: false })
	storagePathName: string;

	@Column({ name: 'BackupProviderCode', type: 'varchar', length: 50, nullable: false })
	backupProviderCode: string;

	@Column({ name: 'DaysToKeepCount', type: 'integer', nullable: false })
	daysToKeepCount: number;

	@Column({ name: 'HoldFlag', type: 'bit', nullable: false })
	holdFlag: boolean;

	// TypeORM maps bigint to string; in JS/TS, MAX_SAFE_INTEGER is in the 9-peta range
	// which should be large enough for this use case. So, I'm telling TypeORM it's an
	// integer so it will map to number and will test with MAX_SAFE_INTEGER to ensure
	// it doesn't truncate the value
	@Column({ name: 'BackupByteCount', type: 'integer' })
	backupByteCount: number;

	@Column({ name: 'CopyStartTimestamp', type: 'datetime2' })
	copyStartTimestamp: Date;

	@Column({ name: 'CopyEndTimestamp', type: 'datetime2' })
	copyEndTimestamp: Date;

	@Column({ name: 'VerifyStartTimestamp', type: 'datetime2', nullable: true })
	verifyStartTimestamp: Date | null | undefined;

	@Column({ name: 'VerifyEndTimestamp', type: 'datetime2', nullable: true })
	verifyEndTimestamp: Date | null | undefined;

	@Column({ name: 'VerifyHashText', type: 'varchar', length: 250, nullable: true })
	verifyHashText: string | null | undefined;

	@Column({ name: 'DueToDeleteDate', type: 'datetime2', nullable: true })
	dueToDeleteDate: Date | null | undefined;

	@Column({ name: 'DeletedTimestamp', type: 'datetime2', nullable: true })
	deletedTimestamp: Date | null | undefined;
}
