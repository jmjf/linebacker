export const StoreResultTypeValues = {
	Succeeded: 'Succeeded',
	Failed: 'Failed',
} as const;
// as const prevents changing or adding values;

export type StoreResultType = typeof StoreResultTypeValues[keyof typeof StoreResultTypeValues];

export const validStoreResultTypes = Object.values(StoreResultTypeValues);
