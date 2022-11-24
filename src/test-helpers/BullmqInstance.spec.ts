jest.mock('bullmq');
import * as bullMq from 'bullmq';
import { IEventBusEvent } from '../common/infrastructure/event-bus/IEventBus';
import { BackupRequestAccepted } from '../backup-request/domain/BackupRequestAccepted.event';
const mockBullMq = jest.mocked(bullMq);

process.env.EVENT_BUS_TYPE = 'bullmq';
import { eventBus } from '../common/infrastructure/event-bus/eventBus';

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
		const publishSpy = jest.spyOn(eventBus, 'publishEvent');
		const testEvent = {
			topicName: 'topic',
			key: 'key',
			eventData: {
				data: 'this is a test',
			},
		};

		const result = await eventBus.publishEvent(testEvent as unknown as IEventBusEvent);

		console.log('result', result);

		expect(result.isOk()).toBe(true);
	});
});
