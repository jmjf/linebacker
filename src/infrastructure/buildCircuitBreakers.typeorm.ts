import { isTypeormConnected } from '../typeorm/isTypeormConnected';
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
		isAlive: isTypeormConnected,
		abortSignal,
		...circuitBreakerConfig.typeorm,
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
