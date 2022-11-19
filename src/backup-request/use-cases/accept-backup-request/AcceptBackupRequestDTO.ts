export interface AcceptBackupRequestDTO {
	backupJobId: string; // UUIDv4
	dataDate: string; // yyyy-mm-dd
	backupDataLocation: string;
	transportType: string; // HTTP or Queue
	getOnStartFlag: boolean;
	requesterId?: string;
}
