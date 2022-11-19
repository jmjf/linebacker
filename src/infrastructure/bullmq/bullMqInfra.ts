import * as bmq from 'bullmq';

export const bullMq = bmq;

export type BullMq = typeof bullMq;

export const bullMqConnection = {
	host: 'localhost',
	port: 6379,
};
