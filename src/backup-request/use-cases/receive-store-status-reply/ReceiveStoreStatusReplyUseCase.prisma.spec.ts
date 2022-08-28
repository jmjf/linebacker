import { IBackupJobProps } from '../../../backup-job/domain/BackupJob';
import {
	mockBackupJobProps,
	MockBackupJobServiceAdapter,
} from '../../../backup-job/adapter/impl/MockBackupJobServiceAdapter';
import { BackupProviderTypeValues } from '../../../backup-job/domain/BackupProviderType';

import { StoreResultTypeValues } from '../../domain/StoreResultType';
import { RequestStatusTypeValues } from '../../domain/RequestStatusType';
import { RequestTransportTypeValues } from '../../domain/RequestTransportType';

import { StoreStatusReplyDTO } from './StoreStatusReplyDTO';
import { ReceiveStoreStatusReplyUseCase } from './ReceiveStoreStatusReplyUseCase';

import { PrismaBackupRequestRepo } from '../../adapter/impl/PrismaBackupRequestRepo';
import { PrismaBackupRepo } from '../../../backup/adapter/impl/PrismaBackupRepo';

import {
	MockPrismaContext,
	PrismaContext,
	createMockPrismaContext,
} from '../../../common/infrastructure/database/prismaContext';
import { PrismaBackup, PrismaBackupRequest } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';

describe('ReceiveStoreStatusReplyUseCase - Prisma', () => {
	let mockPrismaCtx: MockPrismaContext;
	let prismaCtx: PrismaContext;

	beforeEach(() => {
		mockPrismaCtx = createMockPrismaContext();
		prismaCtx = mockPrismaCtx as unknown as PrismaContext;
	});

	const createBackupReply: StoreStatusReplyDTO = {
		backupRequestId: 'backup request',
		storagePathName: '/path/to/backup/storage',
		resultTypeCode: StoreResultTypeValues.Succeeded,
		backupByteCount: 1000000,
		copyStartTimestamp: '2022-05-06T00:20:03.111Z',
		copyEndTimestamp: '2022-05-06T00:32:23.888Z',
	};

	const backupJobDTO: IBackupJobProps = {
		storagePathName: 'storage/path',
		backupProviderCode: BackupProviderTypeValues.CloudB,
		daysToKeep: 100,
		isActive: true,
		holdFlag: false,
	};

	const dbBackupRequest: PrismaBackupRequest = {
		backupRequestId: 'dbBackupRequestId',
		backupJobId: 'dbBackupJobId',
		dataDate: new Date(),
		preparedDataPathName: 'prepared/data/path',
		getOnStartFlag: true,
		transportTypeCode: RequestTransportTypeValues.HTTP,
		statusTypeCode: RequestStatusTypeValues.Sent,
		receivedTimestamp: new Date(),
		requesterId: 'dbRequesterId',
		backupProviderCode: 'CloudA',
		checkedTimestamp: new Date(),
		storagePathName: 'dbStoragePathName',
		sentToInterfaceTimestamp: new Date(),
		replyTimestamp: null,
		replyMessageText: null,
	};

	const prismaBackup: PrismaBackup = {
		backupId: 'backupId',
		backupRequestId: 'dbBackupRequestId',
		backupJobId: 'dbBackupJobId',
		dataDate: new Date('2022-05-30'),
		backupProviderCode: 'CloudA',
		storagePathName: 'path/to/backup/storage/prisma',
		daysToKeepCount: 42,
		holdFlag: false,
		backupByteCount: BigInt(9999999),
		copyStartTimestamp: new Date('2022-05-30T20:00:00Z'),
		copyEndTimestamp: new Date('2022-05-30T20:11:11Z'),
		verifyStartTimestamp: new Date('2022-05-30T20:11:33Z'),
		verifyEndTimestamp: new Date('2022-05-30T20:20:44Z'),
		verifyHashText: 'verifyHash',
		dueToDeleteDate: new Date('2029-04-30'),
		deletedTimestamp: null as unknown as Date,
	};

	const prismaCode = 'P1010';

	describe('Prerequisites for any update (BackupRequest and BackupJob must exist)', () => {
		test(`when the BackupRequest doesn't exist, it returns a NotFoundError`, async () => {
			// Arrange

			// VS Code sometimes highlights mockPrismaCtx lines as errors (circular reference) -- it is usually wrong
			// findUnique() returns null if not found
			mockPrismaCtx.prisma.prismaBackupRequest.findUnique.mockResolvedValue(null as unknown as PrismaBackupRequest);
			const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);

			const backupRepo = new PrismaBackupRepo(prismaCtx);
			const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');

			const backupJobServiceAdapter = new MockBackupJobServiceAdapter({ getByIdResult: { ...mockBackupJobProps } });

			const useCase = new ReceiveStoreStatusReplyUseCase({
				backupRequestRepo,
				backupRepo,
				backupJobServiceAdapter,
			});
			const dto = {
				...createBackupReply,
				backupRequestId: `request doesn't exist`,
			};

			// Act
			const result = await useCase.execute(dto);

			// Assert
			expect(result.isErr()).toBe(true);
			expect(backupRepoSaveSpy).not.toBeCalled();
			if (result.isErr()) {
				// type guard
				expect(result.error.name).toBe('NotFoundError');
				expect(result.error.message).toMatch(dto.backupRequestId);
			}
		});

		test(`when the BackupJob doesn't exist, it returns a BackupJobServiceError`, async () => {
			// Arrange

			// VS Code sometimes highlights mockPrismaCtx lines as errors (circular reference) -- it is usually wrong
			mockPrismaCtx.prisma.prismaBackupRequest.findUnique.mockResolvedValue(dbBackupRequest);
			const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);

			const backupRepo = new PrismaBackupRepo(prismaCtx);
			const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');

			const backupJobServiceAdapter = new MockBackupJobServiceAdapter({
				getByIdError: new AdapterErrors.BackupJobServiceError(`{msg: 'backup job not found'}`),
			});

			const useCase = new ReceiveStoreStatusReplyUseCase({
				backupRequestRepo,
				backupRepo,
				backupJobServiceAdapter,
			});
			const dto = {
				...createBackupReply,
				backupRequestId: `job doesn't exist`,
			};

			// Act
			const result = await useCase.execute(dto);

			// Assert
			expect(result.isErr()).toBe(true);
			expect(backupRepoSaveSpy).not.toBeCalled();
			if (result.isErr()) {
				// type guard
				expect(result.error.name).toBe('BackupJobServiceError');
				// future, test message
			}
		});
	});

	describe('Reply data quality', () => {
		test('when reply status is invalid, it returns a PropsError', async () => {
			// Arrange

			// VS Code sometimes highlights mockPrismaCtx lines as errors (circular reference) -- it is usually wrong
			mockPrismaCtx.prisma.prismaBackupRequest.findUnique.mockResolvedValue(dbBackupRequest);
			const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);

			const backupRepo = new PrismaBackupRepo(prismaCtx);
			const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');

			const backupJobServiceAdapter = new MockBackupJobServiceAdapter({});

			const useCase = new ReceiveStoreStatusReplyUseCase({
				backupRequestRepo,
				backupRepo,
				backupJobServiceAdapter,
			});
			const dto = { ...createBackupReply };
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			dto.resultTypeCode = 'INVALID';

			// Act
			const result = await useCase.execute(dto);

			// Assert
			expect(result.isErr()).toBe(true);
			expect(backupRepoSaveSpy).not.toBeCalled();
			if (result.isErr()) {
				// type guard
				expect(result.error.name).toBe('PropsError');
				expect(result.error.message).toMatch('resultTypeCode');
			}
		});

		// Can test attributes in BackupRequestReplyDTO because other values are set from retrieved data in the use case
		test.each([
			{ propName: 'backupRequestId' },
			{ propName: 'storagePathName' },
			{ propName: 'backupByteCount' },
			{ propName: 'copyStartTimestamp' },
			{ propName: 'copyEndTimestamp' },
		])('when required reply attribute $propName is missing, it returns a PropsError', async ({ propName }) => {
			// Arrange

			// VS Code sometimes highlights mockPrismaCtx lines as errors (circular reference) -- it is usually wrong
			mockPrismaCtx.prisma.prismaBackupRequest.findUnique.mockResolvedValue(dbBackupRequest);
			const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);

			mockPrismaCtx.prisma.prismaBackup.findFirst.mockResolvedValue(null as unknown as PrismaBackup);
			mockPrismaCtx.prisma.prismaBackup.upsert.mockResolvedValue({} as PrismaBackup);
			const backupRepo = new PrismaBackupRepo(prismaCtx);
			const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');

			const backupJobServiceAdapter = new MockBackupJobServiceAdapter({ getByIdResult: { ...backupJobDTO } });

			const useCase = new ReceiveStoreStatusReplyUseCase({
				backupRequestRepo,
				backupRepo,
				backupJobServiceAdapter,
			});
			const dto = { ...createBackupReply };
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			dto[propName] = undefined;

			// Act
			const result = await useCase.execute(dto);

			// Assert
			expect(result.isErr()).toBe(true);
			expect(backupRepoSaveSpy).not.toBeCalled();
			if (result.isErr()) {
				// type guard
				expect(result.error.name).toBe('PropsError');
				expect(result.error.message).toMatch(propName);
			}
		});
	});

	describe('Partial updates (at least one save() fails)', () => {
		test(`when reply is Succeeded but BackupRepo.save() fails, it doesn't save the BackupRequest and returns a DatabaseError`, async () => {
			// Arrange

			// VS Code sometimes highlights mockPrismaCtx lines as errors (circular reference) -- it is usually wrong

			mockPrismaCtx.prisma.prismaBackupRequest.findUnique.mockResolvedValue(dbBackupRequest);
			// BackupRequest save() should never be called, so don't need a mock result
			const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);
			const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

			// Backup save() will fail
			mockPrismaCtx.prisma.prismaBackup.findFirst.mockResolvedValue(null as unknown as PrismaBackup);
			mockPrismaCtx.prisma.prismaBackup.upsert.mockRejectedValue(
				new PrismaClientKnownRequestError('Some upsert failure', prismaCode, '2')
			);
			const backupRepo = new PrismaBackupRepo(prismaCtx);
			const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');

			const backupJobServiceAdapter = new MockBackupJobServiceAdapter({ getByIdResult: { ...backupJobDTO } });

			const useCase = new ReceiveStoreStatusReplyUseCase({
				backupRequestRepo,
				backupRepo,
				backupJobServiceAdapter,
			});
			const dto = { ...createBackupReply };
			dto.resultTypeCode = StoreResultTypeValues.Succeeded;

			// Act
			const result = await useCase.execute(dto);

			// Assert
			expect(result.isErr()).toBe(true);
			expect(backupRepoSaveSpy).toBeCalledTimes(1);
			expect(backupRequestSaveSpy).not.toBeCalled(); // never called, so the Err must be from backupRepo
			if (result.isErr()) {
				// type guard
				expect(result.error.name).toBe('DatabaseError');
				// ensure it fails in the BackupRepo.save, not some other DatabaseError
				expect((result.error as AdapterErrors.DatabaseError).functionName).toBe('PrismaBackupRepo.save');
			}
		});

		test(`when reply is Succeeded and BackupRepo.save() succeeds but BackupRequestRepo.save() fails, it returns a DatabaseError`, async () => {
			// Arrange

			// VS Code sometimes highlights mockPrismaCtx lines as errors (circular reference) -- it is usually wrong

			mockPrismaCtx.prisma.prismaBackupRequest.findUnique.mockResolvedValue(dbBackupRequest);
			// BackupRequest save() will fail
			mockPrismaCtx.prisma.prismaBackupRequest.upsert.mockRejectedValue(
				new PrismaClientKnownRequestError('Some upsert failure', prismaCode, '2')
			);
			const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);
			const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

			mockPrismaCtx.prisma.prismaBackup.findFirst.mockResolvedValue(null as unknown as PrismaBackup);
			mockPrismaCtx.prisma.prismaBackup.upsert.mockResolvedValue({} as PrismaBackup);
			const backupRepo = new PrismaBackupRepo(prismaCtx);
			const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');

			const backupJobServiceAdapter = new MockBackupJobServiceAdapter({ getByIdResult: { ...backupJobDTO } });

			const useCase = new ReceiveStoreStatusReplyUseCase({
				backupRequestRepo,
				backupRepo,
				backupJobServiceAdapter,
			});
			const dto = { ...createBackupReply };
			dto.resultTypeCode = StoreResultTypeValues.Succeeded;

			// Act
			const result = await useCase.execute(dto);

			// Assert
			expect(result.isErr()).toBe(true);
			expect(backupRepoSaveSpy).toBeCalledTimes(1);
			expect(backupRequestSaveSpy).toBeCalledTimes(1);
			if (result.isErr()) {
				// type guard
				expect(result.error.name).toBe('DatabaseError');
				// ensure it fails in the BackupRequestRepo.save, not some other DatabaseError
				expect((result.error as AdapterErrors.DatabaseError).functionName).toBe('PrismaBackupRequestRepo.save');
			}
		});
	});

	describe('Simple updates (Backup does not exist)', () => {
		test('when reply is Succeeded and Backup does not exist, both repo save()s are called and it returns a BackupRequest (Succeeded status)', async () => {
			// Arrange

			// VS Code sometimes highlights mockPrismaCtx lines as errors (circular reference) -- it is usually wrong

			mockPrismaCtx.prisma.prismaBackupRequest.findUnique.mockResolvedValue(dbBackupRequest);
			mockPrismaCtx.prisma.prismaBackupRequest.upsert.mockResolvedValue({} as PrismaBackupRequest);
			const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);
			const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

			mockPrismaCtx.prisma.prismaBackup.findFirst.mockResolvedValue(null as unknown as PrismaBackup);
			mockPrismaCtx.prisma.prismaBackup.upsert.mockResolvedValue({} as PrismaBackup);
			const backupRepo = new PrismaBackupRepo(prismaCtx);
			const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');

			const backupJobServiceAdapter = new MockBackupJobServiceAdapter({ getByIdResult: { ...backupJobDTO } });

			const useCase = new ReceiveStoreStatusReplyUseCase({
				backupRequestRepo,
				backupRepo,
				backupJobServiceAdapter,
			});
			const dto = { ...createBackupReply };
			dto.resultTypeCode = StoreResultTypeValues.Succeeded;

			// Act
			const result = await useCase.execute(dto);

			// Assert
			expect(result.isOk()).toBe(true);
			expect(backupRequestSaveSpy).toBeCalledTimes(1);
			expect(backupRepoSaveSpy).toBeCalledTimes(1);
			if (result.isOk()) {
				// type guard
				expect(result.value.constructor.name).toBe('BackupRequest');
				expect(result.value.statusTypeCode).toBe(RequestStatusTypeValues.Succeeded);
			}
		});

		test('when reply is Failed and a Backup does not exist, only BackupRequest.save() is called and it returns a BackupRequest (Failed status)', async () => {
			// Arrange

			// VS Code sometimes highlights mockPrismaCtx lines as errors (circular reference) -- it is usually wrong

			mockPrismaCtx.prisma.prismaBackupRequest.findUnique.mockResolvedValue(dbBackupRequest);
			mockPrismaCtx.prisma.prismaBackupRequest.upsert.mockResolvedValue({} as PrismaBackupRequest);
			const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);
			const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

			mockPrismaCtx.prisma.prismaBackup.findFirst.mockResolvedValue(null as unknown as PrismaBackup);
			mockPrismaCtx.prisma.prismaBackup.upsert.mockResolvedValue({} as PrismaBackup);
			const backupRepo = new PrismaBackupRepo(prismaCtx);
			const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');

			const backupJobServiceAdapter = new MockBackupJobServiceAdapter({ getByIdResult: { ...backupJobDTO } });

			const useCase = new ReceiveStoreStatusReplyUseCase({
				backupRequestRepo,
				backupRepo,
				backupJobServiceAdapter,
			});
			const dto = { ...createBackupReply };
			dto.resultTypeCode = StoreResultTypeValues.Failed;

			// Act
			const result = await useCase.execute(dto);

			// Assert
			expect(result.isOk()).toBe(true);
			expect(backupRequestSaveSpy).toBeCalledTimes(1);
			expect(backupRepoSaveSpy).not.toBeCalled();
			if (result.isOk()) {
				// type guard
				expect(result.value.constructor.name).toBe('BackupRequest');
				expect(result.value.statusTypeCode).toBe(RequestStatusTypeValues.Failed);
			}
		});
	});

	describe('Duplicate replies (Backup exists)', () => {
		test('when BackupRequest.save() fails, it returns a DatabaseError and does not call Backup.save()', async () => {
			// Arrange

			// VS Code sometimes highlights mockPrismaCtx lines as errors (circular reference) -- it is usually wrong

			mockPrismaCtx.prisma.prismaBackupRequest.findUnique.mockResolvedValue(dbBackupRequest);
			mockPrismaCtx.prisma.prismaBackupRequest.upsert.mockRejectedValue(
				new PrismaClientKnownRequestError('rejected', prismaCode, '2')
			);
			const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);
			const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

			// findFirst() for getByBackupRequestId()
			mockPrismaCtx.prisma.prismaBackup.findFirst.mockResolvedValue(prismaBackup as PrismaBackup);
			mockPrismaCtx.prisma.prismaBackup.upsert.mockResolvedValue({} as PrismaBackup); // succeed if called, shouldn't be called
			const backupRepo = new PrismaBackupRepo(prismaCtx);
			const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');

			const backupJobServiceAdapter = new MockBackupJobServiceAdapter({ getByIdResult: { ...backupJobDTO } });

			const useCase = new ReceiveStoreStatusReplyUseCase({
				backupRequestRepo,
				backupRepo,
				backupJobServiceAdapter,
			});
			const dto = { ...createBackupReply };
			dto.resultTypeCode = StoreResultTypeValues.Succeeded;

			// Act
			const result = await useCase.execute(dto);

			// Assert
			expect(result.isErr()).toBe(true);
			expect(backupRequestSaveSpy).toBeCalledTimes(1);
			expect(backupRepoSaveSpy).not.toBeCalled();
			if (result.isErr()) {
				// type guard
				expect(result.error.name).toBe('DatabaseError');
				// ensure it fails in the BackupRequestRepo.save, not some other DatabaseError
				expect((result.error as AdapterErrors.DatabaseError).functionName).toBe('PrismaBackupRequestRepo.save');
			}
		});

		test.each([
			{
				requestStatus: RequestStatusTypeValues.Sent,
				resultStatus: StoreResultTypeValues.Succeeded,
			},
			{
				requestStatus: RequestStatusTypeValues.Sent,
				resultStatus: StoreResultTypeValues.Failed,
			},
			{
				requestStatus: RequestStatusTypeValues.Succeeded,
				resultStatus: StoreResultTypeValues.Succeeded,
			},
			{
				requestStatus: RequestStatusTypeValues.Succeeded,
				resultStatus: StoreResultTypeValues.Failed,
			},
			{
				requestStatus: RequestStatusTypeValues.Failed,
				resultStatus: StoreResultTypeValues.Succeeded,
			},
			{
				requestStatus: RequestStatusTypeValues.Failed,
				resultStatus: StoreResultTypeValues.Failed,
			},
		])(
			'when BackupRequest status is $requestStatus, StoreResult status $resultStatus, and BackupRequest.save() succeeds, it returns a BackupRequest (Succeeded status) and does not call Backup.save()',
			async ({ requestStatus, resultStatus }) => {
				// Arrange

				// VS Code sometimes highlights mockPrismaCtx lines as errors (circular reference) -- it is usually wrong

				mockPrismaCtx.prisma.prismaBackupRequest.findUnique.mockResolvedValue({
					...dbBackupRequest,
					statusTypeCode: requestStatus,
				});
				mockPrismaCtx.prisma.prismaBackupRequest.upsert.mockResolvedValue({} as PrismaBackupRequest);
				const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);
				const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

				// findFirst() for getByBackupRequestId()
				mockPrismaCtx.prisma.prismaBackup.findFirst.mockResolvedValue(prismaBackup as PrismaBackup);
				mockPrismaCtx.prisma.prismaBackup.upsert.mockResolvedValue({} as PrismaBackup); // succeed if called, shouldn't be called
				const backupRepo = new PrismaBackupRepo(prismaCtx);
				const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');

				const backupJobServiceAdapter = new MockBackupJobServiceAdapter({ getByIdResult: { ...backupJobDTO } });

				const useCase = new ReceiveStoreStatusReplyUseCase({
					backupRequestRepo,
					backupRepo,
					backupJobServiceAdapter,
				});
				const dto = { ...createBackupReply };
				dto.resultTypeCode = resultStatus;

				// Act
				const result = await useCase.execute(dto);

				// Assert
				expect(result.isOk()).toBe(true);
				expect(backupRequestSaveSpy).toBeCalledTimes(1);
				expect(backupRepoSaveSpy).not.toBeCalled();
				if (result.isOk()) {
					// type guard
					expect(result.value.constructor.name).toBe('BackupRequest');
					expect(result.value.statusTypeCode).toBe(RequestStatusTypeValues.Succeeded);
				}
			}
		);
	});
});
