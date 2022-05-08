export const RequestStatusTypeValues = {
   Received: 'Received',
   Allowed: 'Allowed',
   NotAllowed: 'NotAllowed',
   Sent: 'Sent',
   Succeeded: 'Succeeded',
   Failed: 'Failed'
} as const;
// as const prevents changing or adding values;

export type RequestStatusType = typeof RequestStatusTypeValues[keyof typeof RequestStatusTypeValues];

export const validRequestStatusTypes = Object.values(RequestStatusTypeValues);