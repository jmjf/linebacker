const RequestStatuses = {
   Received: 'Received',
   Allowed: 'Allowed',
   NotAllowed: 'NotAllowed',
   Sent: 'Sent',
   Succeeded: 'Succeeded',
   Failed: 'Failed'
} as const;
// as const prevents changing or adding values;

export type RequestStatusType = typeof RequestStatuses[keyof typeof RequestStatuses];

export const validRequestStatusTypes = Object.values(RequestStatuses);