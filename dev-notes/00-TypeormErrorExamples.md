Example of what gets logged from the controller when the database is down.

For logging purposes, I think `callerMessage`, `callerLine`, `errorData.functionName`, `errorData.moduleName`, and `errorData.driverError` are most likely to be useful if they're available.

```json
    error: {
      "callerMessage": "ConnectionError: Failed to connect to localhost:1433 - Could not connect (sequence)",
      "callerLine": "at TypeormBackupRequestRepo.save (/home/jmjf/dev/linebacker/src/backup-request/adapter/impl/TypeormBackupRequestRepo.ts:79:15)",
      "functionName": "TypeormBackupRequestRepo.save",
      "fileName": "TypeormBackupRequestRepo",
      "code": "Database",
      "errorData": {
        "query": "SELECT \"TypeormBackupRequest\".\"BackupRequestIdentifier\" AS \"TypeormBackupRequest_BackupRequestIdentifier\", \"TypeormBackupRequest\".\"BackupJobIdentifier\" AS \"TypeormBackupRequest_BackupJobIdentifier\", \"TypeormBackupRequest\".\"DataDate\" AS \"TypeormBackupRequest_DataDate\", \"TypeormBackupRequest\".\"PreparedDataPathName\" AS \"TypeormBackupRequest_PreparedDataPathName\", \"TypeormBackupRequest\".\"GetOnStartFlag\" AS \"TypeormBackupRequest_GetOnStartFlag\", \"TypeormBackupRequest\".\"TransportTypeCode\" AS \"TypeormBackupRequest_TransportTypeCode\", \"TypeormBackupRequest\".\"BackupProviderCode\" AS \"TypeormBackupRequest_BackupProviderCode\", \"TypeormBackupRequest\".\"StoragePathName\" AS \"TypeormBackupRequest_StoragePathName\", \"TypeormBackupRequest\".\"StatusTypeCode\" AS \"TypeormBackupRequest_StatusTypeCode\", \"TypeormBackupRequest\".\"ReceivedTimestamp\" AS \"TypeormBackupRequest_ReceivedTimestamp\", \"TypeormBackupRequest\".\"CheckedTimestamp\" AS \"TypeormBackupRequest_CheckedTimestamp\", \"TypeormBackupRequest\".\"SentToInterfaceTimestamp\" AS \"TypeormBackupRequest_SentToInterfaceTimestamp\", \"TypeormBackupRequest\".\"ReplyTimestamp\" AS \"TypeormBackupRequest_ReplyTimestamp\", \"TypeormBackupRequest\".\"RequesterIdentifier\" AS \"TypeormBackupRequest_RequesterIdentifier\", \"TypeormBackupRequest\".\"ReplyMessageText\" AS \"TypeormBackupRequest_ReplyMessageText\" FROM \"dbo\".\"BackupRequest\" \"TypeormBackupRequest\" WHERE \"TypeormBackupRequest\".\"BackupRequestIdentifier\" IN (@0)",
        "parameters": [
          "4nFPb0aOnDOpFF0Sl_6Fo"
        ],
        "driverError": {
          "code": "ESOCKET",
          "originalError": {
            "message": "Failed to connect to localhost:1433 - Could not connect (sequence)",
            "code": "ESOCKET"
          },
          "name": "ConnectionError"
        },
        "code": "ESOCKET",
        "originalError": {
          "message": "Failed to connect to localhost:1433 - Could not connect (sequence)",
          "code": "ESOCKET"
        },
        "moduleName": "TypeormBackupRequestRepo.ts",
        "functionName": "save"
      },
      "name": "DatabaseError"
    }
```
