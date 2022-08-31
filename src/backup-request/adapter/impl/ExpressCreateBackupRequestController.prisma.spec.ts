import request from 'supertest';

import { buildApp } from '../../../expressAppPrisma';

import { ICreateBackupRequestBody } from './ExpressCreateBackupRequestController';

import {
	MockPrismaContext,
	PrismaContext,
	createMockPrismaContext,
} from '../../../common/infrastructure/prismaContext';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime';

import { RequestStatusTypeValues } from '../../domain/RequestStatusType';

describe('ExpressCreateBackupRequestController', () => {
	let mockPrismaCtx: MockPrismaContext;
	let prismaCtx: PrismaContext;

	beforeEach(() => {
		mockPrismaCtx = createMockPrismaContext();
		prismaCtx = mockPrismaCtx as unknown as PrismaContext;
	});

	const testUrl = '/backup-requests';

	const basePayload = {
		apiVersion: '2022-05-22',
		backupJobId: 'job-id',
		dataDate: '2022-05-30',
		backupDataLocation: 'data-location',
	} as ICreateBackupRequestBody;

	test('when apiVersion is invalid, it returns 400 and an error', async () => {
		// Arrange
		const app = buildApp(prismaCtx);

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
		const prismaCode = 'P1012';
		mockPrismaCtx.prisma.prismaBackupRequest.upsert.mockRejectedValue(
			new PrismaClientKnownRequestError('Key is already defined', prismaCode, '2')
		);
		const app = buildApp(prismaCtx);

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
		expect(payload.message).toBe(prismaCode.slice(1)); // ensure message is clean
	});

	test('when the use case returns a PropsError, the controller returns 400 and an error', async () => {
		// Arrange
		const app = buildApp(prismaCtx);

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
		const app = buildApp(prismaCtx);

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

		expect(payload.backupRequestId.length).toBe(21); // can't validate nanoid like a UUID
		expect(payload.statusTypeCode).toBe(RequestStatusTypeValues.Received);
		expect(payload.backupJobId).toBe(basePayload.backupJobId);
		expect(payload.preparedDataPathName).toBe(basePayload.backupDataLocation);
		expect(payload.dataDate).toBe(basePayload.dataDate);
		expect(receivedTimestamp.valueOf()).toBeGreaterThanOrEqual(startTime.valueOf());
		expect(receivedTimestamp.valueOf()).toBeLessThanOrEqual(endTime.valueOf());
	});
});
