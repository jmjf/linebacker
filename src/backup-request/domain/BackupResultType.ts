const BackupResults = {
   Succeeded: 'Succeeded',
   Failed: 'Failed'
} as const;
// as const prevents changing or adding values;

export type BackupResultType = typeof BackupResults[keyof typeof BackupResults];

export const validBackupResultTypes = Object.values(BackupResults);