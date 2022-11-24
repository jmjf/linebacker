import * as bullMq from 'bullmq';

import { BullmqEventBus } from './BullmqEventBus';
import { bullMqConnection } from '../../../infrastructure/bullmq/bullMqInfra';
import { MemoryEventBus } from './MemoryEventBus';

const eventBusType = (process.env.EVENT_BUS_TYPE || 'memory').toLowerCase();

export const eventBus = eventBusType === 'bullmq' ? new BullmqEventBus(bullMq, bullMqConnection) : new MemoryEventBus();