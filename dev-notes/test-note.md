**MyRequestQueueAdapter.ts**

```typescript
import * as bullMq from 'bullmq';
type BullMq = typeof bullMq;

import { IQueueAdapter } from './IQueueAdapter';

export class MyRequestQueueAdapter implements IQueueAdapter {
	private bullMq: BullMq;

	constructor(bullMq: BullMq) {
		this.bullMq = bullMq;
	}

	publishRequest(queueName: string, request: MyRequest): Result<Job, Error> {
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

**useCase.ts**

```typescript
import { MyRequestQueueAdapter } from '../adapters/MyRequestQueueAdapter';

export class MyUseCase {
   private queueAdapter: IQueueAdapter;

   constructor(queueAdapter: IQueueAdapter) {
      this.queueAdapter = queueAdapter;
   }

   async execute(request: RawRequest) {
      // oversimplified
      const myRequest = prepareRequest(request);

      const publishResult = await this.queueAdapter.publishRequest('Accepted', myRequest);
      if (publishResult.isErr()) {
         return err(...);
      }

      return ok(myRequest);

   }
}
```

**useCase.spec.ts**

```typescript
jest.mock('bullmq');
import * as bullMq from 'bullmq';
const mockBullMq = jest.mocked(bullMq);

describe('MyUseCase', () => {
   beforeEach(() => {
      mockBullMq.Queue.mockClear();
      // if using mocks of other types, add mockClear() for them too
   });

   test('it fails', async () => {
      mockBullMq.Queue.prototype.add = jest.fn().mockRejectedValue(new Error('mock queue failure'));
      const addSpy = mockBullMq.Queue.prototype.add;
      const adapter = new MyRequestQueueAdapter(bullMq);
      const useCase = new MyUseCase(adapter);

      const res = await useCase.execute({...});

      expect(res.isErr()).toBe(true);
      expect(addSpy).toHaveBeenCalledTimes(1);
      // other assertions
   });

   test ('it succeeds', async () => {
      mockBullMq.Queue.prototype.add = jest.fn().mockResolvedValue({} as unknown as bullMq.Job);
      const addSpy = mockBullMq.Queue.prototype.add;
      const adapter = new MyRequestQueueAdapter(bullMq);
      const useCase = new MyUseCase(adapter);

      const res = await useCase.execute({...});

      expect(res.isOk()).toBe(true);
      expect(addSpy).toHaveBeenCalledTimes(1);
      // other assertions
   });
})
```
