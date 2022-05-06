export interface BackupStatusReplyDTO {
   apiVersion: string, // yyyy-mm-dd
   backupRequestId: string,   // -> UniqueIdentifier (UUIDv4)
   backupStorageLocation: string,
   resultType: string, // -> ReplyResultType
   backupBytes: number,  
      // max safe integer: 9,007,199,254,740,991 -> 9 PB
      // AWS, Azure, GCP -> 4TB max blob size
   copyStartTimestamp: string   // Date
   copyEndTimestamp: string     // Date
   verifyStartTimestamp?: string // Date
   verifyEndTimestamp?: string   // Date
   verifiedHash?: string
}