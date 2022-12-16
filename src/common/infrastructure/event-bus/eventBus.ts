import * as bullMq from 'bullmq';

import { appState } from '../../../infrastructure/app-state/appState';

import { BullmqEventBus } from './BullmqEventBus';
import { MemoryEventBus } from './MemoryEventBus';

const eventBusType = (appState.eventBus_type || 'memory').toLowerCase();

export const eventBus =
	eventBusType === 'bullmq'
		? new BullmqEventBus(bullMq, {
				host: appState.bullmq_redisHost,
				port: appState.bullmq_redisPort,
		  })
		: new MemoryEventBus();
