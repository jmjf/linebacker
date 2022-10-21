import request from 'supertest';

import { getLenientCircuitBreaker } from '../../test-helpers/circuitBreakerHelpers';

import { buildApp } from '../../expressAppTypeorm';

import {
	MockTypeormContext,
	TypeormContext,
	createMockTypeormContext,
} from '../../infrastructure/typeorm/typeormContext';
import { CircuitBreakerWithRetry } from '../../infrastructure/resilience/CircuitBreakerWithRetry';

import { delay } from '../../common/utils/utils';
import { logger } from '../../infrastructure/logging/pinoLogger';

describe('Zpages - typeorm', () => {
	let mockTypeormCtx: MockTypeormContext;
	let typeormCtx: TypeormContext;
	let dbCircuitBreaker: CircuitBreakerWithRetry;
	let azureQueueCircuitBreaker: CircuitBreakerWithRetry;
	let abortController: AbortController;

	beforeEach(() => {
		mockTypeormCtx = createMockTypeormContext();
		typeormCtx = mockTypeormCtx as unknown as TypeormContext;

		abortController = new AbortController();
		dbCircuitBreaker = getLenientCircuitBreaker('TypeORM', abortController.signal);
		azureQueueCircuitBreaker = getLenientCircuitBreaker('AzureQueue', abortController.signal);
	});

	afterEach(() => {
		abortController.abort();
		delay(250);
	});

	const fakeAuthHeader = 'fakeTypeORM|na';

	test('when livez is called, it returns 200', async () => {
		// Arrange
		const app = buildApp(logger, typeormCtx, { dbCircuitBreaker, azureQueueCircuitBreaker }, abortController.signal);
		const testUrl = '/api/zpages/livez';

		// Act
		const response = await request(app).get(testUrl).set('TestAuth', fakeAuthHeader);

		// Assert
		expect(response.statusCode).toBe(200);
	});

	test('when readyz is called, it returns 200', async () => {
		// Arrange
		const app = buildApp(logger, typeormCtx, { dbCircuitBreaker, azureQueueCircuitBreaker }, abortController.signal);
		const testUrl = '/api/zpages/readyz';

		// Act
		const response = await request(app).get(testUrl).set('TestAuth', fakeAuthHeader);

		// Assert
		expect(response.statusCode).toBe(200);
	});
});
