const RequestTransports = {
   HTTP: 'HTTP',
   Queue: 'Queue',
} as const;
// as const prevents changing or adding values;

export type RequestTransportType = typeof RequestTransports[keyof typeof RequestTransports];

export const validRequestTransportTypes = Object.values(RequestTransports);