import { isPrismaConnected } from './isPrismaConnected';
import { CircuitBreakerWithRetry } from '../resilience/CircuitBreakerWithRetry';

import circuitBreakerConfig from '../resilience/circuitBreakerConfig.json';
import { AzureQueue } from '../azure-queue/AzureQueue';

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
