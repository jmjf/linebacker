use linebacker;

-- SQL Server doesn't like the name Backup, so BackupInstance
-- But I'm only changing it here
CREATE TABLE BackupInstance (
	BackupIdentifier varchar(50) NOT NULL UNIQUE CLUSTERED,
	BackupRequestIdentifier varchar(50) NOT NULL,
	BackupJobIdentifier varchar(50) NOT NULL,
	DataDate datetimeoffset NOT NULL,
	StoragePathName varchar(250) NOT NULL,
	BackupProviderCode varchar(50) NOT NULL,
	DaysToKeepCount integer NOT NULL,
	HoldFlag bit NOT NULL,
	BackupByteCount bigint NULL,
	CopyStartTimestamp datetimeoffset NULL,
	CopyEndTimestamp datetimeoffset NULL,
	VerifyStartTimestamp datetimeoffset NULL,
	VerifyEndTimestamp datetimeoffset NULL,
	VerifyHashText varchar(250) NULL,
	DueToDeleteDate datetimeoffset NULL,
	DeletedTimestamp datetimeoffset NULL
);