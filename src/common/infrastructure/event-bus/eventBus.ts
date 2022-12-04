import * as bullMq from 'bullmq';

import { BullmqEventBus } from './BullmqEventBus';
import { MemoryEventBus } from './MemoryEventBus';

export const eventBusType = (process.env.EVENT_BUS_TYPE || 'memory').toLowerCase();

export const bullMqConnection = {
	host: 'localhost',
	port: 6379,
};

export const eventBus = eventBusType === 'bullmq' ? new BullmqEventBus(bullMq, bullMqConnection) : new MemoryEventBus();
