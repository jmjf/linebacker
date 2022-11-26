use linebacker;

CREATE TABLE BackupRequest (
	BackupRequestIdentifier varchar(50) NOT NULL UNIQUE CLUSTERED,
	BackupJobIdentifier varchar(50) NOT NULL,
	DataDate datetimeoffset NOT NULL,
	PreparedDataPathName varchar(250) NOT NULL,
	GetOnStartFlag bit NOT NULL,
	TransportTypeCode varchar(50) NOT NULL,
	BackupProviderCode varchar(50) NULL,
	StoragePathName varchar(250) NULL,
	StatusTypeCode varchar(50) NOT NULL,
	AcceptedTimestamp datetimeoffset NULL,
	ReceivedTimestamp datetimeoffset NULL,
	CheckedTimestamp datetimeoffset NULL,
	SentToInterfaceTimestamp datetimeoffset NULL,
	ReplyTimestamp datetimeoffset NULL,
	RequesterIdentifier varchar(50) NULL,
	ReplyMessageText varchar(250) NULL,
);
