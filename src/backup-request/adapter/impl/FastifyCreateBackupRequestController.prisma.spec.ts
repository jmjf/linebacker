import { getLenientCircuitBreaker } from '../../../test-helpers/circuitBreakerHelpers';

import { buildApp } from '../../../fastifyApp';

import { ICreateBackupRequestBody } from './FastifyCreateBackupRequestController';

import { ok } from '../../../common/core/Result';

import { BackupRequestStatusTypeValues } from '../../domain/BackupRequestStatusType';
import { CircuitBreakerWithRetry } from '../../../infrastructure/resilience/CircuitBreakerWithRetry';
import {
	MockPrismaContext,
	PrismaContext,
	createMockPrismaContext,
} from '../../../infrastructure/prisma/prismaContext';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime';

import { delay } from '../../../common/utils/utils';

describe('FastifyCreateBackupRequestController', () => {
	let mockPrismaCtx: MockPrismaContext;
	let prismaCtx: PrismaContext;
	let dbCircuitBreaker: CircuitBreakerWithRetry;
	let azureQueueCircuitBreaker: CircuitBreakerWithRetry;
	let abortController: AbortController;

	beforeEach(() => {
		mockPrismaCtx = createMockPrismaContext();
		prismaCtx = mockPrismaCtx as unknown as PrismaContext;

		const isAlive = () => {
			return Promise.resolve(ok(true));
		};

		abortController = new AbortController();
		dbCircuitBreaker = getLenientCircuitBreaker('TypeORM', abortController.signal);
		azureQueueCircuitBreaker = getLenientCircuitBreaker('AzureQueue', abortController.signal);
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
		const app = buildApp(prismaCtx, { dbCircuitBreaker, azureQueueCircuitBreaker }, abortController.signal);

		// Act
		const response = await app.inject({
			method: 'POST',
			url: testUrl,
			payload: {
				...basePayload,
				apiVersion: 'invalid',
			},
		});

		// Assert
		expect(response.statusCode).toBe(400);
		// convert body to an object we can use -- may throw an error if body isn't JSON
		const body = JSON.parse(response.body);
		expect(body.code).toBe('InvalidApiVersion');
	});

	test('when the use case gets a database error, the controller returns 500 and a low-leak error', async () => {
		// Arrange
		// simulate a database error
		const prismaCode = 'P1012';
		mockPrismaCtx.prisma.prismaBackupRequest.upsert.mockRejectedValue(
			new PrismaClientKnownRequestError('Key is already defined', { code: prismaCode, clientVersion: '2' })
		);
		const app = buildApp(prismaCtx, { dbCircuitBreaker, azureQueueCircuitBreaker }, abortController.signal);

		// Act
		const response = await app.inject({
			method: 'POST',
			url: testUrl,
			payload: {
				...basePayload,
			},
		});

		// Assert
		expect(response.statusCode).toBe(500);
		// convert payload to an object we can use -- may throw an error if payload isn't JSON
		const payload = JSON.parse(response.payload);
		expect(payload.code).toBe('Database');
		expect(payload.message).toBe(prismaCode.slice(1)); // ensure message is clean
	});

	test('when the use case returns a PropsError, the controller returns 400 and an error', async () => {
		// Arrange
		const app = buildApp(prismaCtx, { dbCircuitBreaker, azureQueueCircuitBreaker }, abortController.signal);

		// Act
		const response = await app.inject({
			method: 'POST',
			url: testUrl,
			payload: {
				...basePayload,
				dataDate: '', // easy error to force
			},
		});

		// Assert
		expect(response.statusCode).toBe(400);
		// convert payload to an object we can use -- may throw an error if payload isn't JSON
		const payload = JSON.parse(response.payload);
		expect(payload.code).toBe('BadData');
		expect(payload.message).toMatch('dataDate');
	});

	test('when request data is good, the controller returns Accepted and a result payload', async () => {
		// Arrange
		const app = buildApp(prismaCtx, { dbCircuitBreaker, azureQueueCircuitBreaker }, abortController.signal);

		// Act
		const startTime = new Date();
		const response = await app.inject({
			method: 'POST',
			url: testUrl,
			payload: {
				...basePayload,
			},
		});
		const endTime = new Date();

		// Assert
		expect(response.statusCode).toBe(202);
		// convert payload to an object we can use -- may throw an error if payload isn't JSON
		const payload = JSON.parse(response.payload);
		const receivedTimestamp = new Date(payload.receivedTimestamp);

		expect(payload.backupRequestId.length).toBe(21);
		expect(payload.statusTypeCode).toBe(BackupRequestStatusTypeValues.Received);
		expect(payload.backupJobId).toBe(basePayload.backupJobId);
		expect(payload.preparedDataPathName).toBe(basePayload.backupDataLocation);
		expect(payload.dataDate).toBe(basePayload.dataDate);
		expect(receivedTimestamp.valueOf()).toBeGreaterThanOrEqual(startTime.valueOf());
		expect(receivedTimestamp.valueOf()).toBeLessThanOrEqual(endTime.valueOf());
	});
});
