import { ok } from '../common/core/Result';
import { CircuitBreakerWithRetry } from '../infrastructure/CircuitBreakerWithRetry';

export function getLenientCircuitBreaker(serviceName: string, abortSignal: AbortSignal): CircuitBreakerWithRetry {
	const isAlive = () => {
		return Promise.resolve(ok(true));
	};

	return new CircuitBreakerWithRetry({
		isAlive,
		abortSignal,
		serviceName,
		successToCloseCount: 1,
		failureToOpenCount: 100,
		halfOpenRetryDelayMs: 5,
		closedRetryDelayMs: 5,
		openAliveCheckDelayMs: 5,
	});
}
