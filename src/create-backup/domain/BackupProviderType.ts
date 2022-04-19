const BackupProviders = {
   None: '',
   Local: 'Local',
   CloudA: 'CloudA',
   CloudB: 'CloudB'
} as const;
// as const prevents changing or adding values;

export type BackupProviderType = typeof BackupProviders[keyof typeof BackupProviders];

export const validBackupProvidersTypes = Object.values(BackupProviders);