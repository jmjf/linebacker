export const BackupRequestStatusTypeValues = {
	Accepted: 'Accepted',
	Received: 'Received',
	Allowed: 'Allowed',
	NotAllowed: 'NotAllowed',
	Sent: 'Sent',
	Succeeded: 'Succeeded',
	Failed: 'Failed',
} as const;
// as const prevents changing or adding values;

export type BackupRequestStatusType = typeof BackupRequestStatusTypeValues[keyof typeof BackupRequestStatusTypeValues];

export const validBackupRequestStatusTypes = Object.values(BackupRequestStatusTypeValues);
