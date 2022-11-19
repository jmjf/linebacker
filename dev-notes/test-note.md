Here's how I am testing with Jest and BullMQ.

This strategy is may not work if you're using events or other features that rely on behavior that may be mocked by `jest.mock()`. Or it may give some ideas about how to approach mocking for those cases

For publishing jobs to the queue...

I have adapters that separate the queue service (BullMQ, Kafka, whatever) from the business process logic (use cases).

**ExampleQueueAdapter.ts**

```typescript
import { IQueueAdapter } from './IQueueAdapter';
import { Result, ok, err } from '../../common/core/Result';
import { BullMq } from '../../infrastructure/bull-mq/BullMq';
// BullMq is a type for all of bullmq
// import * as bullMq from 'bullmq';
// export type BullMq = typeof bullMq;

// adapters implement interfaces
export class ExampleQueueAdapter implements IQueueAdapter {
	private bullMq: BullMq;

	constructor(bullMq: BullMq) {
		this.bullMq = bullMq;
	}

	publish(queueName: string, request: Example): Result<BullMq.Job, Error> {
		try {
			const queue = new Queue(queueName);
			const res = await queue.add(request.id, request);
			return ok(res);
		} catch (e) {
			return err(e as Error);
		}
	}
}
```

**ExampleUseCase.ts**

```typescript
import { IQueueAdapter } from '../adapters/IQueueAdapter';

export class ExampleUseCase extends UseCase {
   // use cases use adapter interfaces instead of adapter implementations
   private queueAdapter: IQueueAdapter;

   constructor(queueAdapter: IQueueAdapter) {
      this.queueAdapter = queueAdapter;
   }

   async execute(request: RawRequest) {
      // oversimplified use case logic
      const exampleRequest = request;

      const publishResult = await this.queueAdapter.publish('Accepted', exampleRequest);
      if (publishResult.isErr()) {
         return err(...);
      }

      return ok(exampleRequest);
   }
}
```

To test the use case

**useCase.spec.ts**

```typescript
jest.mock('bullmq');
import * as bullMq from 'bullmq';
const mockBullMq = jest.mocked(bullMq);

describe('ExampleUseCase', () => {
   beforeEach(() => {
      mockBullMq.Queue.mockClear();
      // if using mocks of other types, add mockClear() for them too
   });

   test('it fails before it calls publish', async () => {
      // mock conditions that cause the use case to fail before calling publish
      const addSpy = mockBullMq.Queue.prototype.add;
      const adapter = new ExampleQueueAdapter(bullMq);
      const useCase = new ExampleUseCase(adapter);

      const res = await useCase.execute({...});

      expect(res.isErr()).toBe(true);
      expect(addSpy).toHaveBeenCalledTimes(0);
      // other assertions
   });

   test('it fails on publish', async () => {
      mockBullMq.Queue.prototype.add = jest.fn().mockRejectedValue(new Error('mock queue failure'));
      const addSpy = mockBullMq.Queue.prototype.add;
      const adapter = new ExampleQueueAdapter(bullMq);
      const useCase = new ExampleUseCase(adapter);

      const res = await useCase.execute({...});

      expect(res.isErr()).toBe(true);
      expect(addSpy).toHaveBeenCalledTimes(1);
      // other assertions
   });

   test ('it succeeds on publish', async () => {
      mockBullMq.Queue.prototype.add = jest.fn().mockResolvedValue({} as unknown as bullMq.Job);
      const addSpy = mockBullMq.Queue.prototype.add;
      const adapter = new ExampleQueueAdapter(bullMq);
      const useCase = new ExampleUseCase(adapter);

      const res = await useCase.execute({...});

      expect(res.isOk()).toBe(true);
      expect(addSpy).toHaveBeenCalledTimes(1);
      // other assertions
   });
})
```

For queue processors (consumers), I create a consumer class that includes a consumer method.

```typescript
import { Job } from 'bullmq';
import { ok } from '../../../common/core/Result';
import { Example2UseCase } from '../../use-cases/receive-backup-request/Example2UseCase';
import { config } from '../../common/core/config';

export class AcceptedBackupRequestConsumer implements IQueueConsumer {
	private useCase: Example2UseCase;

	constructor(example2UseCase: Example2UseCase) {
		this.useCase = example2UseCase;
	}

	async consume(job: Job) {
		const { attemptsMade, data } = job;

		const { connectFailureCount, ...request } = data;

		const result = await this.useCase.execute(request);
		if (result.isErr()) {
			// log error

			// connect errors always retry
			if (error.isConnectError()) {
				job.update({ connectFailureCount: connectFailureCount++ });
				throw new Error('connect failure retry');
			}

			// else see if it has exceeded non-connect failures
			if (attemptsMade - connectFailureCount > config.maxRetries) {
				throw new UnrecoverableError('do not retry');
			}

			// else retry
			throw new Error('general failure retry');
		}

		// success
		return result.value;
	}
}
```

And test it like this

```typescript
jest.mock('bullmq');
import * as bullMq from 'bullmq';
const mockBullMq = jest.mocked(bullMq);

import { ExampleConsumer } from './ExampleConsumer';

describe('ExampleConsumer - BullMq', () => {
   test('when called with a job that fails, it throws something', async () => {
      expect.assertions(1);
      const useCase = new Example2UseCase(...);
      // mock use case dependency to return a connect failure
      // for example, for a database call, mockRejectedValue(...)

		const queue = new mockBullMq.Queue('test-queue');
		const job = new mockBullMq.Job(queue, 'test-name', {});
      // the Job constructor is mocked, so doesn't set up data
		job.data = { connectFailureCount: 0, message: 'Hello World!' };
      job.attemptsMade = 0; // can test exceeding retry threshold

      const consumer = new ExampleConsumer(useCase);

		try {
			const result = await consumer.consume(job);
			console.log('unexpected success', result);
		} catch (e) {
         const err = e as Error;
			expect(e.constructor.name).toEqual('UnrecoverableError');
			// that's all we can check because UnrecoverableError's constructor is mocked
		}
   });

	test('when called with a Job, it does something', async () => {
		const useCase = new Example2UseCase(...);

      // another way to build the job; does not require a queue
      const job = {
         data: {
            connectFailureCount: 0,
            message: 'Hi World!'
         },
         attemptsMade: 0
      } as unknown as bullMq.Job;

      const consumer = new ExampleConsumer(useCase);

      const result = consumer.consume(job);

		expect((result as any).message).toEqual('Hello World!');
	});
});
```
