import { IBackupJobProps } from '../../../backup-job/domain/BackupJob';
import { BackupProviderTypeValues } from '../../../backup-job/domain/BackupProviderType';
import { MockBackupJobServiceAdapter } from '../../../backup-job/adapter/impl/MockBackupJobServiceAdapter';

import { BackupRequestStatusType, BackupRequestStatusTypeValues } from '../../domain/BackupRequestStatusType';
import { RequestTransportTypeValues } from '../../domain/RequestTransportType';

import { CheckRequestAllowedDTO } from './CheckRequestAllowedDTO';
import { CheckRequestAllowedUseCase } from './CheckRequestAllowedUseCase';

import { CircuitBreakerWithRetry } from '../../../infrastructure/resilience/CircuitBreakerWithRetry';
import { ok } from '../../../common/core/Result';

import {
	MockPrismaContext,
	PrismaContext,
	createMockPrismaContext,
} from '../../../infrastructure/prisma/prismaContext';
import { PrismaBackupRequest } from '@prisma/client';
import { PrismaBackupRequestRepo } from '../../adapter/impl/PrismaBackupRequestRepo';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';
import { Dictionary } from '../../../common/utils/utils';

describe('CheckRequestAllowedUseCase - Prisma', () => {
	let mockPrismaCtx: MockPrismaContext;
	let prismaCtx: PrismaContext;
	let circuitBreaker: CircuitBreakerWithRetry;
	let abortController: AbortController;

	beforeEach(() => {
		mockPrismaCtx = createMockPrismaContext();
		prismaCtx = mockPrismaCtx as unknown as PrismaContext;

		const isAlive = () => {
			return Promise.resolve(ok(true));
		};

		abortController = new AbortController();
		circuitBreaker = new CircuitBreakerWithRetry({
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
		circuitBreaker.halt();
	});

	const baseDto: CheckRequestAllowedDTO = {
		backupRequestId: 'checkAllowedRequestId',
	};

	const backupJobProps: IBackupJobProps = {
		storagePathName: 'my/storage/path',
		backupProviderCode: BackupProviderTypeValues.CloudA,
		daysToKeep: 3650,
		isActive: true,
		holdFlag: false,
	};

	const dbBackupRequest: PrismaBackupRequest = {
		backupRequestId: 'dbBackupRequestId',
		backupJobId: 'dbBackupJobId',
		dataDate: new Date(),
		preparedDataPathName: 'path',
		getOnStartFlag: true,
		transportTypeCode: RequestTransportTypeValues.HTTP,
		statusTypeCode: BackupRequestStatusTypeValues.Received,
		receivedTimestamp: new Date(),
		requesterId: 'dbRequesterId',
		backupProviderCode: null,
		storagePathName: null,
		checkedTimestamp: null,
		sentToInterfaceTimestamp: null,
		replyTimestamp: null,
		replyMessageText: null,
	};

	test('when backup job for request meets allowed rules, it returns a BackupRequest in Allowed status', async () => {
		// Arrange

		// VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
		mockPrismaCtx.prisma.prismaBackupRequest.findUnique.mockResolvedValue(dbBackupRequest);

		const repo = new PrismaBackupRequestRepo(prismaCtx, circuitBreaker);

		const adapter = new MockBackupJobServiceAdapter({
			getByIdResult: { ...backupJobProps },
		});

		const useCase = new CheckRequestAllowedUseCase({
			backupRequestRepo: repo,
			backupJobServiceAdapter: adapter,
		});
		const dto = { ...baseDto };

		// Act
		const startTimestamp = new Date();
		const result = await useCase.execute(dto);

		// Assert
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			// type guard makes the rest easier
			expect(result.value.statusTypeCode).toBe(BackupRequestStatusTypeValues.Allowed);
			expect(result.value.checkedTimestamp.valueOf()).toBeGreaterThanOrEqual(startTimestamp.valueOf());
		}
	});

	test('when backup request is not found by id, it returns failure', async () => {
		// Arrange

		// findUnique() returns null if not found
		// VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
		mockPrismaCtx.prisma.prismaBackupRequest.findUnique.mockResolvedValue(null as unknown as PrismaBackupRequest);

		const repo = new PrismaBackupRequestRepo(prismaCtx, circuitBreaker);

		const adapter = new MockBackupJobServiceAdapter({
			getByIdError: new AdapterErrors.NotFoundError(
				`{ msg: 'backupJobId not found for backupRequestId ${baseDto.backupRequestId}'`
			),
		});

		const useCase = new CheckRequestAllowedUseCase({
			backupRequestRepo: repo,
			backupJobServiceAdapter: adapter,
		});
		const dto = { ...baseDto };

		// Act
		const result = await useCase.execute(dto);

		// Assert
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			// type guard
			expect(result.error.name).toBe('NotFoundError');
			expect((result.error.errorData as any).backupRequestId).toMatch(dto.backupRequestId);
		}
	});

	test('when backup job is not found, it returns failure', async () => {
		// Arrange

		// VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
		mockPrismaCtx.prisma.prismaBackupRequest.findUnique.mockResolvedValue(dbBackupRequest);

		const repo = new PrismaBackupRequestRepo(prismaCtx, circuitBreaker);

		const adapter = new MockBackupJobServiceAdapter({
			getByIdError: new AdapterErrors.BackupJobServiceError(`{msg: 'backupJobId not found' }`),
		});

		const useCase = new CheckRequestAllowedUseCase({
			backupRequestRepo: repo,
			backupJobServiceAdapter: adapter,
		});
		const dto = { ...baseDto };

		// Act
		const result = await useCase.execute(dto);

		// Assert
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			// type guard
			expect(result.error.name).toBe('BackupJobServiceError');
			// future test message too
		}
	});

	test('when request status type is not post-received value and not Received, it returns failure', async () => {
		// Arrange

		// VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
		mockPrismaCtx.prisma.prismaBackupRequest.findUnique.mockResolvedValue({
			...dbBackupRequest,
			statusTypeCode: 'INVALID',
		});

		const repo = new PrismaBackupRequestRepo(prismaCtx, circuitBreaker);

		const adapter = new MockBackupJobServiceAdapter({ getByIdResult: { ...backupJobProps } });

		const useCase = new CheckRequestAllowedUseCase({
			backupRequestRepo: repo,
			backupJobServiceAdapter: adapter,
		});
		const dto = { ...baseDto };

		// Act
		const result = await useCase.execute(dto);

		// Assert
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			// type guard
			expect(result.error.name).toBe('BackupRequestStatusError');
			expect(result.error.message).toMatch('in Received');
		}
	});

	// test.each(statusTestCases) runs the same test with different data (defined in statusTestCases)
	// I had to coerce several types to get the test to behave, but now this one block of code tests all the cases
	const statusTestCases = [
		{
			status: BackupRequestStatusTypeValues.Allowed,
			timestamp: 'checkedTimestamp',
		},
		{
			status: BackupRequestStatusTypeValues.NotAllowed,
			timestamp: 'checkedTimestamp',
		},
		{
			status: BackupRequestStatusTypeValues.Sent,
			timestamp: 'sentToInterfaceTimestamp',
		},
		{
			status: BackupRequestStatusTypeValues.Succeeded,
			timestamp: 'replyTimestamp',
		},
		{ status: BackupRequestStatusTypeValues.Failed, timestamp: 'replyTimestamp' },
	];
	test.each(statusTestCases)(
		'when backup request is in $status status, it returns an err (must be Received)',
		async ({ status, timestamp }) => {
			// Arrange
			// timestamp that matters is defined in inputs, so need to add it after setting up base props
			const resultBackupRequest: Dictionary = {
				...dbBackupRequest,
				statusTypeCode: status as BackupRequestStatusType,
			};
			resultBackupRequest[timestamp] = new Date();

			// VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
			mockPrismaCtx.prisma.prismaBackupRequest.findUnique.mockResolvedValue(
				resultBackupRequest as PrismaBackupRequest
			);

			const repo = new PrismaBackupRequestRepo(prismaCtx, circuitBreaker);
			const saveSpy = jest.spyOn(repo, 'save');

			const adapter = new MockBackupJobServiceAdapter({ getByIdResult: { ...backupJobProps } });

			const useCase = new CheckRequestAllowedUseCase({
				backupRequestRepo: repo,
				backupJobServiceAdapter: adapter,
			});
			const dto = { ...baseDto };

			// Act
			const result = await useCase.execute(dto);

			// Assert
			expect(result.isErr()).toBe(true);
			expect(saveSpy).toHaveBeenCalledTimes(0);
			if (result.isErr()) {
				// type guard
				expect(result.error.name).toBe('BackupRequestStatusError');
				expect((result.error.errorData as any).statusTypeCode).toContain(status);
			}
		}
	);
});
