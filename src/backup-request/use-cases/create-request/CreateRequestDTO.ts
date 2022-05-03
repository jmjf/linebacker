export interface CreateRequestDTO {
   apiVersion: string, // yyyy-mm-dd
   backupJobId: string, // UUIDv4
   dataDate: string, // yyyy-mm-dd
   backupDataLocation: string
   transportType: string, // HTTP or Queue
   getOnStartFlag: boolean
};