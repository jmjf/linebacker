export const BackupResultTypeValues = {
   Succeeded: 'Succeeded',
   Failed: 'Failed'
} as const;
// as const prevents changing or adding values;

export type BackupResultType = typeof BackupResultTypeValues[keyof typeof BackupResultTypeValues];

export const validBackupResultTypes = Object.values(BackupResultTypeValues);