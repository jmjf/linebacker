import * as bullMq from 'bullmq';

export type BullMq = typeof bullMq;

export const bullMqConnection = {
	host: 'localhost',
	port: 6379,
};
