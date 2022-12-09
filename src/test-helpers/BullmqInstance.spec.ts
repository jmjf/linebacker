jest.mock('bullmq');
import * as bullMq from 'bullmq';

import { appState } from '../infrastructure/app-state/appState';
appState.eventBus_type = 'bullmq';

import { eventBus } from '../common/infrastructure/event-bus/eventBus';
import { EventBusEvent } from '../common/infrastructure/event-bus/IEventBus';

describe('BmqInstance', () => {
	const mockBullMq = jest.mocked(bullMq);

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

		const result = await eventBus.publishEvent(testEvent as unknown as EventBusEvent<unknown>);

		// console.log('result', result);

		expect(result.isOk()).toBe(true);
		expect(publishSpy).toHaveBeenCalled();
	});
});
