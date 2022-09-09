import { isPrismaConnected } from '../prisma/isPrismaConnected';
import { CircuitBreakerWithRetry } from './CircuitBreakerWithRetry';

import circuitBreakerConfig from '../circuitBreakerConfig.json';
import { AzureQueue } from './AzureQueue';

export interface ICircuitBreakers {
	dbCircuitBreaker: CircuitBreakerWithRetry;
	azureQueueCircuitBreaker: CircuitBreakerWithRetry;
	// jobServiceCircuitBreaker: CircuitBreakerWithRetry;
}

export function buildCircuitBreakers(abortSignal: AbortSignal): ICircuitBreakers {
	const dbCircuitBreaker = new CircuitBreakerWithRetry({
		isAlive: isPrismaConnected,
		abortSignal,
		...circuitBreakerConfig.prisma,
	});

	const azureQueueCircuitBreaker = new CircuitBreakerWithRetry({
		isAlive: AzureQueue.isConnected.bind(AzureQueue),
		abortSignal: abortSignal,
		...circuitBreakerConfig.azureQueue,
	});

	// const jobServiceCircuitBreaker = new CircuitBreakerWithRetry ({
	// 	isAlive: isJobServiceConnected,
	// 	abortSignal: abortSignal,
	// 	...circuitBreakerConfig.azureQueue
	// });

	return {
		dbCircuitBreaker,
		azureQueueCircuitBreaker,
		// jobServiceCircuitBreaker
	};
}
