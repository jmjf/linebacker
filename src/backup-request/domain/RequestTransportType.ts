export const RequestTransportTypeValues = {
	HTTP: 'HTTP',
	Queue: 'Queue',
} as const;
// as const prevents changing or adding values;

export type RequestTransportType = typeof RequestTransportTypeValues[keyof typeof RequestTransportTypeValues];

export const validRequestTransportTypes = Object.values(RequestTransportTypeValues);
