import request from 'supertest';

import { buildApp } from '../../../expressAppTypeorm';

import { ICreateBackupRequestBody } from './ExpressCreateBackupRequestController';

import { MockTypeormContext, TypeormContext, createMockTypeormContext } from '../../../infrastructure/typeormContext';
import { CircuitBreakerWithRetry } from '../../../infrastructure/CircuitBreakerWithRetry';
import { ok } from '../../../common/core/Result';

import { RequestStatusTypeValues } from '../../domain/RequestStatusType';
import { TypeORMError } from 'typeorm';
import { delay } from '../../../utils/utils';

describe('ExpressCreateBackupRequestController - typeorm', () => {
	let mockTypeormCtx: MockTypeormContext;
	let typeormCtx: TypeormContext;
	let dbCircuitBreaker: CircuitBreakerWithRetry;
	let abortController: AbortController;

	beforeEach(() => {
		mockTypeormCtx = createMockTypeormContext();
		typeormCtx = mockTypeormCtx as unknown as TypeormContext;

		const isAlive = () => {
			return Promise.resolve(ok(true));
		};
		abortController = new AbortController();
		dbCircuitBreaker = new CircuitBreakerWithRetry({
			isAlive,
			abortSignal: abortController.signal,
			serviceName: 'TypeORM',
			successToCloseCount: 1,
			failureToOpenCount: 100,
			halfOpenRetryDelayMs: 5,
			closedRetryDelayMs: 5,
			openAliveCheckDelayMs: 5,
		});
	});

	afterEach(() => {
		abortController.abort();
		delay(250);
	});

	const testUrl = '/api/backup-requests';

	const basePayload = {
		apiVersion: '2022-05-22',
		backupJobId: 'job-id',
		dataDate: '2022-05-30',
		backupDataLocation: 'data-location',
	} as ICreateBackupRequestBody;

	test('when apiVersion is invalid, it returns 400 and an error', async () => {
		// Arrange
		const app = buildApp(typeormCtx, { dbCircuitBreaker });

		// Act
		const response = await request(app)
			.post(testUrl)
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

	test('when the use case gets a database error, the controller returns 500 and a low-leak error', async () => {
		// Arrange
		// simulate a database error
		mockTypeormCtx.manager.save.mockRejectedValue(new TypeORMError('Key is already defined'));
		const app = buildApp(typeormCtx, { dbCircuitBreaker });

		// Act
		const response = await request(app)
			.post(testUrl)
			.send({
				...basePayload,
			});

		// Assert
		expect(response.statusCode).toBe(500);
		// convert payload to an object we can use -- may throw an error if JSON.parse fails
		const payload = JSON.parse(response.text);
		expect(payload.code).toBe('Database');
		// TODO: understand how message will return to ensure message is clean for TypeORM
	});

	test('when the use case returns a PropsError, the controller returns 400 and an error', async () => {
		// Arrange
		const app = buildApp(typeormCtx, { dbCircuitBreaker });

		// Act
		const response = await request(app)
			.post(testUrl)
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
		const app = buildApp(typeormCtx, { dbCircuitBreaker });

		// Act
		const startTime = new Date();
		const response = await request(app)
			.post(testUrl)
			.send({
				...basePayload,
			});
		const endTime = new Date();

		// Assert
		expect(response.statusCode).toBe(202);
		// convert text to an object we can use -- may throw an error if not JSON
		const payload = JSON.parse(response.text);
		const receivedTimestamp = new Date(payload.receivedTimestamp);

		expect(payload.backupRequestId.length).toBe(21); // nanoid isn't "verifiable" like a UUID
		expect(payload.statusTypeCode).toBe(RequestStatusTypeValues.Received);
		expect(payload.backupJobId).toBe(basePayload.backupJobId);
		expect(payload.preparedDataPathName).toBe(basePayload.backupDataLocation);
		expect(payload.dataDate).toBe(basePayload.dataDate);
		expect(receivedTimestamp.valueOf()).toBeGreaterThanOrEqual(startTime.valueOf());
		expect(receivedTimestamp.valueOf()).toBeLessThanOrEqual(endTime.valueOf());
	});
});
