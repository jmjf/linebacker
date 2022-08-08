export const BackupProviderTypeValues = {
   None: '',
   Local: 'Local',
   CloudA: 'CloudA',
   CloudB: 'CloudB'
} as const;
// as const prevents changing or adding values;

export type BackupProviderType = typeof BackupProviderTypeValues[keyof typeof BackupProviderTypeValues];

export const validBackupProviderTypes = Object.values(BackupProviderTypeValues);