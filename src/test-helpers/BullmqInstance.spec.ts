jest.mock('bullmq');
import * as bullMq from 'bullmq';
import { IEventBusEvent } from '../common/infrastructure/event-bus/IEventBus';
import { BackupRequestAccepted } from '../backup-request/domain/BackupRequestAccepted.event';
const mockBullMq = jest.mocked(bullMq);

import { bullmqBus } from '../common/infrastructure/event-bus/BullmqEventBus';

describe('BmqInstance', () => {
	beforeEach(() => {
		mockBullMq.Queue.mockClear();
	});

	const testEvent = {
		topicName: 'topic',
		key: 'key',
		eventData: {
			data: 'this is a test',
		},
	};

	test('basic test', async () => {
		mockBullMq.Queue.prototype.add.mockResolvedValue({} as bullMq.Job);
		const publishSpy = jest.spyOn(bullmqBus, 'publishEvent');
		const testEvent = {
			topicName: 'topic',
			key: 'key',
			eventData: {
				data: 'this is a test',
			},
		};

		const result = await bullmqBus.publishEvent(testEvent as unknown as IEventBusEvent);

		console.log('result', result);

		expect(result.isOk()).toBe(true);
	});
});
