import { Column, Entity } from 'typeorm';

@Entity({ name: 'BackupInstance' })
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

	@Column({ name: 'DataDate', type: 'datetimeoffset', nullable: false })
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
	// which should be large enough for this use case. Unfortunately, TypeORM will not
	// allow an integer outside the +/- ~2.4-giga range. So, let TypeORM do a string
	// like it wants and, in the repo, let the mappers handle it.
	@Column({ name: 'BackupByteCount', type: 'bigint' })
	backupByteCount: string;

	@Column({ name: 'CopyStartTimestamp', type: 'datetimeoffset' })
	copyStartTimestamp: Date;

	@Column({ name: 'CopyEndTimestamp', type: 'datetimeoffset' })
	copyEndTimestamp: Date;

	@Column({ name: 'VerifyStartTimestamp', type: 'datetimeoffset', nullable: true })
	verifyStartTimestamp: Date | null | undefined;

	@Column({ name: 'VerifyEndTimestamp', type: 'datetimeoffset', nullable: true })
	verifyEndTimestamp: Date | null | undefined;

	@Column({ name: 'VerifyHashText', type: 'varchar', length: 250, nullable: true })
	verifyHashText: string | null | undefined;

	@Column({ name: 'DueToDeleteDate', type: 'datetimeoffset', nullable: true })
	dueToDeleteDate: Date | null | undefined;

	@Column({ name: 'DeletedTimestamp', type: 'datetimeoffset', nullable: true })
	deletedTimestamp: Date | null | undefined;
}
