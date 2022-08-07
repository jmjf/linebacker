-- CreateTable
CREATE TABLE "BackupRequest" (
    "BackupRequestIdentifier" TEXT NOT NULL,
    "BackupJobIdentifier" TEXT NOT NULL,
    "DataDate" TIMESTAMP(3) NOT NULL,
    "PreparedDataPathName" TEXT NOT NULL,
    "GetOnStartFlag" BOOLEAN NOT NULL,
    "TransportTypeCode" TEXT NOT NULL,
    "BackupProviderCode" TEXT,
    "StoragePathName" TEXT,
    "StatusTypeCode" TEXT NOT NULL,
    "ReceivedTimestamp" TIMESTAMP(3) NOT NULL,
    "CheckedTimestamp" TIMESTAMP(3),
    "SentToInterfaceTimestamp" TIMESTAMP(3),
    "ReplyTimestamp" TIMESTAMP(3),
    "RequesterIdentifier" TEXT,
    "ReplyMessageText" TEXT,

    CONSTRAINT "BackupRequest_pkey" PRIMARY KEY ("BackupRequestIdentifier")
);

-- CreateTable
CREATE TABLE "Backup" (
    "BackupIdentifier" TEXT NOT NULL,
    "BackupRequestIdentifier" TEXT NOT NULL,
    "BackupJobIdentifier" TEXT NOT NULL,
    "DataDate" TIMESTAMP(3) NOT NULL,
    "StoragePathName" TEXT NOT NULL,
    "BackupProviderCode" TEXT NOT NULL,
    "DaysToKeepCount" INTEGER NOT NULL,
    "HoldFlag" BOOLEAN NOT NULL,
    "BackupByteCount" BIGINT NOT NULL,
    "CopyStartTimestamp" TIMESTAMP(3) NOT NULL,
    "CopyEndTimestamp" TIMESTAMP(3) NOT NULL,
    "VerifyStartTimestamp" TIMESTAMP(3) NOT NULL,
    "VerifyEndTimestamp" TIMESTAMP(3) NOT NULL,
    "VerifyHashText" TEXT NOT NULL,
    "DueToDeleteDate" TIMESTAMP(3) NOT NULL,
    "DeletedTimestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Backup_pkey" PRIMARY KEY ("BackupIdentifier")
);

-- CreateIndex
CREATE UNIQUE INDEX "BackupRequest_BackupRequestIdentifier_key" ON "BackupRequest"("BackupRequestIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "Backup_BackupIdentifier_key" ON "Backup"("BackupIdentifier");
