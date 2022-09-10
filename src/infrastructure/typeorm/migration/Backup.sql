use linebacker;

-- SQL Server doesn't like the name Backup, so BackupInstance
-- But I'm only changing it here
CREATE TABLE BackupInstance (
	BackupIdentifier varchar(50) NOT NULL UNIQUE CLUSTERED,
	BackupRequestIdentifier varchar(50) NOT NULL,
	BackupJobIdentifier varchar(50) NOT NULL,
	DataDate datetime2 NOT NULL,
	StoragePathName varchar(250) NOT NULL,
	BackupProviderCode varchar(50) NOT NULL,
	DaysToKeepCount integer NOT NULL,
	HoldFlag bit NOT NULL,
	BackupByteCount bigint NULL,
	CopyStartTimestamp datetime2 NULL,
	CopyEndTimestamp datetime2 NULL,
	VerifyStartTimestamp datetime2 NULL,
	VerifyEndTimestamp datetime2 NULL,
	VerifyHashText varchar(250) NULL,
	DueToDeleteDate datetime2 NULL,
	DeletedTimestamp datetime2 NULL
);