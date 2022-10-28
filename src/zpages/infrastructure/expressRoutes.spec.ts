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

	const okDependencies = [
		{ depName: 'okDep1', checkDep: () => true },
		{ depName: 'okDep2', checkDep: () => true },
	];

	const errDependency = { depName: 'errDep', checkDep: () => false };

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
		const deps = { readyzDependencies: okDependencies, healthzDependencies: [] };
		const app = buildApp(
			logger,
			typeormCtx,
			{ dbCircuitBreaker, azureQueueCircuitBreaker },
			deps,
			abortController.signal
		);
		const testUrl = '/api/zpages/livez';

		// Act
		const response = await request(app).get(testUrl).set('TestAuth', fakeAuthHeader);

		// Assert
		expect(response.statusCode).toBe(200);
	});

	test('when readyz is called and a dependency is not ok, it returns 500', async () => {
		// Arrange
		const deps = {
			readyzDependencies: [...okDependencies, errDependency, ...okDependencies],
			healthzDependencies: [],
		};
		const app = buildApp(
			logger,
			typeormCtx,
			{ dbCircuitBreaker, azureQueueCircuitBreaker },
			deps,
			abortController.signal
		);
		const testUrl = '/api/zpages/readyz';

		// Act
		const response = await request(app).get(testUrl).set('TestAuth', fakeAuthHeader);

		// Assert
		expect(response.statusCode).toBe(500);
	});

	test('when readyz is called and all dependencies are ok, it returns 200', async () => {
		// Arrange
		const deps = { readyzDependencies: okDependencies, healthzDependencies: [] };
		const app = buildApp(
			logger,
			typeormCtx,
			{ dbCircuitBreaker, azureQueueCircuitBreaker },
			deps,
			abortController.signal
		);
		const testUrl = '/api/zpages/readyz';

		// Act
		const response = await request(app).get(testUrl).set('TestAuth', fakeAuthHeader);

		// Assert
		expect(response.statusCode).toBe(200);
	});

	test('when healthz is called and dependencies are ready, it returns 200 and has data', async () => {
		// Arrange
		const deps = { readyzDependencies: [], healthzDependencies: okDependencies };
		const startTime = new Date();
		const app = buildApp(
			logger,
			typeormCtx,
			{ dbCircuitBreaker, azureQueueCircuitBreaker },
			deps,
			abortController.signal
		);
		const testUrl = '/api/zpages/healthz';

		// Act
		const response = await request(app).get(testUrl).set('TestAuth', fakeAuthHeader);
		const endTime = new Date();

		// Assert
		expect(response.statusCode).toBe(200);
		const payload = JSON.parse(response.text);
		// console.log('healthz', payload);
		expect(new Date(payload.startTime).valueOf()).toBeGreaterThanOrEqual(startTime.valueOf());
		expect(new Date(payload.startTime).valueOf()).toBeLessThanOrEqual(endTime.valueOf());
	});

	test('when healthz is called and a dependency is not ready, it returns 200 and has data identifying the failing dependency', async () => {
		// Arrange
		const deps = {
			readyzDependencies: [],
			healthzDependencies: [...okDependencies, errDependency, { depName: 'okDep3', checkDep: () => true }],
		};
		const startTime = new Date();
		const app = buildApp(
			logger,
			typeormCtx,
			{ dbCircuitBreaker, azureQueueCircuitBreaker },
			deps,
			abortController.signal
		);
		const testUrl = '/api/zpages/healthz';

		// Act
		const response = await request(app).get(testUrl).set('TestAuth', fakeAuthHeader);
		const endTime = new Date();

		// Assert
		expect(response.statusCode).toBe(200);
		const payload = JSON.parse(response.text);
		//console.log('healthz', payload);
		expect(new Date(payload.startTime).valueOf()).toBeGreaterThanOrEqual(startTime.valueOf());
		expect(new Date(payload.startTime).valueOf()).toBeLessThanOrEqual(endTime.valueOf());
		expect(payload.calledServices.errDep).toBe(false);
	});
});
