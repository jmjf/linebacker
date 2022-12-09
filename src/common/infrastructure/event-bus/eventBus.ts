import * as bullMq from 'bullmq';

import { appState } from '../../../infrastructure/app-state/appState';

import { BullmqEventBus } from './BullmqEventBus';
import { MemoryEventBus } from './MemoryEventBus';

export const eventBusType = (appState.eventBus_type || 'memory').toLowerCase();

export const bullMqConnection = {
	host: appState.bullmq_redisHost,
	port: appState.bullmq_redisPort,
};

export const eventBus = eventBusType === 'bullmq' ? new BullmqEventBus(bullMq, bullMqConnection) : new MemoryEventBus();
