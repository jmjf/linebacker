jest.mock('bullmq');
import * as bullMq from 'bullmq';

import request from 'supertest';

// must import appState before other application imports to ensure value is set correctly for test
import { appState } from '../../../infrastructure/app-state/appState';
appState.eventBus_type = 'bullmq';

import { buildApp } from '../../../apiAppExpTypeorm';

import {
	MockTypeormContext,
	TypeormContext,
	createMockTypeormContext,
} from '../../../infrastructure/typeorm/typeormContext';
import { CircuitBreakerWithRetry } from '../../../infrastructure/resilience/CircuitBreakerWithRetry';

import { logger } from '../../../infrastructure/logging/pinoLogger';

import { delay } from '../../../common/utils/utils';
import { EventBusError } from '../../../common/infrastructure/InfrastructureErrors';

import { ICreateBackupRequestBody } from './ExpressCreateBackupRequestController';
import { BackupRequestStatusTypeValues } from '../../domain/BackupRequestStatusType';

import { getLenientCircuitBreaker } from '../../../test-helpers/circuitBreakerHelpers';

describe('ExpressAcceptBackupRequestController - typeorm', () => {
	let mockTypeormCtx: MockTypeormContext;
	let typeormCtx: TypeormContext;

	let dbCircuitBreaker: CircuitBreakerWithRetry;
	let azureQueueCircuitBreaker: CircuitBreakerWithRetry;
	let abortController: AbortController;
	const zpageDependencies = { readyzDependencies: [], healthzDependencies: [] };
	const mockBullMq = jest.mocked(bullMq);

	beforeEach(() => {
		mockTypeormCtx = createMockTypeormContext();
		typeormCtx = mockTypeormCtx as unknown as TypeormContext;

		mockBullMq.Queue.mockClear();

		abortController = new AbortController();
		dbCircuitBreaker = getLenientCircuitBreaker('TypeORM', abortController.signal);
		azureQueueCircuitBreaker = getLenientCircuitBreaker('AzureQueue', abortController.signal);
	});

	afterEach(async () => {
		abortController.abort();
		await delay(250);
	});

	const testUrl = '/api/backup-requests';
	const fakeAuthHeader = 'fakeTypeORM|post-backup-request';

	const basePayload = {
		apiVersion: '2022-05-22',
		backupJobId: 'job-id',
		dataDate: '2022-05-30',
		backupDataLocation: 'data-location',
	} as ICreateBackupRequestBody;

	test('when apiVersion is invalid, it returns 400 and an error', async () => {
		// Arrange
		const app = buildApp(
			logger,
			typeormCtx,
			{ dbCircuitBreaker, azureQueueCircuitBreaker },
			zpageDependencies,
			abortController.signal
		);

		// Act
		const response = await request(app)
			.post(testUrl)
			.set('TestAuth', fakeAuthHeader)
			.send({
				...basePayload,
				apiVersion: 'invalid',
			});

		// Assert
		expect(response.statusCode).toBe(400);
		// convert response payload to an object we can use -- may throw an error if JSON.parse() fails
		const payload = JSON.parse(response.text);
		expect(payload.code).toBe('InvalidApiVersion');
	});

	test('when the use case fails to add to the queue, the controller returns 500 and a low-leak error', async () => {
		// Arrange
		// simulate a database error
		mockBullMq.Queue.prototype.add = jest.fn().mockRejectedValueOnce(new EventBusError('simulated event bus error'));
		const app = buildApp(
			logger,
			typeormCtx,
			{ dbCircuitBreaker, azureQueueCircuitBreaker },
			zpageDependencies,
			abortController.signal
		);

		// Act
		const response = await request(app)
			.post(testUrl)
			.set('TestAuth', fakeAuthHeader)
			.send({
				...basePayload,
			});

		// Assert
		expect(response.statusCode).toBe(500);
		// convert payload to an object we can use -- may throw an error if JSON.parse fails
		const payload = JSON.parse(response.text);
		expect(payload.code).toBe('EventBus');
		// TODO: understand how message will return to ensure message is clean for TypeORM
	});

	test('when the use case returns a PropsError, the controller returns 400 and an error', async () => {
		// Arrange
		const app = buildApp(
			logger,
			typeormCtx,
			{ dbCircuitBreaker, azureQueueCircuitBreaker },
			zpageDependencies,
			abortController.signal
		);

		// Act
		const response = await request(app)
			.post(testUrl)
			.set('TestAuth', fakeAuthHeader)
			.send({
				...basePayload,
				dataDate: '', // easy error to force
			});

		// Assert
		expect(response.statusCode).toBe(400);
		// convert text to an object we can use -- may throw an error if isn't JSON
		const payload = JSON.parse(response.text);
		expect(payload.code).toBe('BadData');
		expect(payload.message).toMatch('dataDate');
	});

	test('when request data is good, the controller returns Accepted and a result payload', async () => {
		// Arrange
		mockBullMq.Queue.prototype.add = jest.fn().mockResolvedValue({} as unknown as bullMq.Job);
		const bmqAddSpy = mockBullMq.Queue.prototype.add;

		const app = buildApp(
			logger,
			typeormCtx,
			{ dbCircuitBreaker, azureQueueCircuitBreaker },
			zpageDependencies,
			abortController.signal
		);

		// Act
		const startTime = new Date();
		const response = await request(app)
			.post(testUrl)
			.set('TestAuth', fakeAuthHeader)
			.send({
				...basePayload,
			});
		const endTime = new Date();

		// Assert
		expect(response.statusCode).toBe(202);
		expect(bmqAddSpy).toHaveBeenCalledTimes(1);
		// convert text to an object we can use -- may throw an error if not JSON
		const payload = JSON.parse(response.text);
		const acceptedTimestamp = new Date(payload.acceptedTimestamp);

		expect(payload.backupRequestId.length).toBe(21); // nanoid isn't "verifiable" like a UUID
		expect(payload.statusTypeCode).toBe(BackupRequestStatusTypeValues.Accepted);
		expect(payload.backupJobId).toBe(basePayload.backupJobId);
		expect(payload.preparedDataPathName).toBe(basePayload.backupDataLocation);
		expect(payload.dataDate).toBe(basePayload.dataDate);
		expect(acceptedTimestamp.valueOf()).toBeGreaterThanOrEqual(startTime.valueOf());
		expect(acceptedTimestamp.valueOf()).toBeLessThanOrEqual(endTime.valueOf());
	});
});
