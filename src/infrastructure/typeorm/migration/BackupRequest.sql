use linebacker;

CREATE TABLE BackupRequest (
	BackupRequestIdentifier varchar(50) NOT NULL UNIQUE CLUSTERED,
	BackupJobIdentifier varchar(50) NOT NULL,
	DataDate datetime2 NOT NULL,
	PreparedDataPathName varchar(250) NOT NULL,
	GetOnStartFlag bit NOT NULL,
	TransportTypeCode varchar(50) NOT NULL,
	BackupProviderCode varchar(50) NULL,
	StoragePathName varchar(250) NULL,
	StatusTypeCode varchar(50) NOT NULL,
	ReceivedTimestamp datetime2 NOT NULL,
	CheckedTimestamp datetime2 NULL,
	SentToInterfaceTimestamp datetime2 NULL,
	ReplyTimestamp datetime2 NULL,
	RequesterIdentifier varchar(50) NULL,
	ReplyMessageText varchar(250) NULL,
);
