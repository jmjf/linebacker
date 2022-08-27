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

import * as AdapterErrors from '../../../common/adapter/AdapterErrors';

import {
	MockTypeormContext,
	TypeormContext,
	createMockTypeormContext,
} from '../../../common/infrastructure/database/typeormContext';
import { TypeormBackupRequestRepo } from '../../adapter/impl/TypeormBackupRequestRepo';
import { TypeormBackupRequest } from '../../../typeorm/entity/TypeormBackupRequest.entity';
import { TypeormBackupRepo } from '../../../backup/adapter/impl/TypeormBackupRepo';
import { TypeormBackup } from '../../../typeorm/entity/TypeormBackup.entity';
import { TypeORMError } from 'typeorm';

describe('ReceiveStoreStatusReplyUseCase', () => {
	let mockTypeormCtx: MockTypeormContext;
	let typeormCtx: TypeormContext;

	beforeEach(() => {
		mockTypeormCtx = createMockTypeormContext();
		typeormCtx = mockTypeormCtx as unknown as TypeormContext;
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

	const dbBackupRequest: TypeormBackupRequest = {
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

	const dbBackup: TypeormBackup = {
		backupId: 'backupId',
		backupRequestId: 'dbBackupRequestId',
		backupJobId: 'dbBackupJobId',
		dataDate: new Date('2022-05-30'),
		backupProviderCode: 'CloudA',
		storagePathName: 'path/to/backup/storage',
		daysToKeepCount: 42,
		holdFlag: false,
		backupByteCount: Number.MAX_SAFE_INTEGER,
		copyStartTimestamp: new Date('2022-05-30T20:00:00Z'),
		copyEndTimestamp: new Date('2022-05-30T20:11:11Z'),
		verifyStartTimestamp: new Date('2022-05-30T20:11:33Z'),
		verifyEndTimestamp: new Date('2022-05-30T20:20:44Z'),
		verifyHashText: 'verifyHash',
		dueToDeleteDate: new Date('2029-04-30'),
		deletedTimestamp: null,
	};

	describe('Prerequisites for any update (BackupRequest and BackupJob must exist)', () => {
		test(`when the BackupRequest doesn't exist, it returns a NotFoundError`, async () => {
			// Arrange

			// findOne() returns null if not found, no other database calls should happen
			mockTypeormCtx.manager.findOne.mockResolvedValue(null);
			const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx);

			const backupRepo = new TypeormBackupRepo(typeormCtx);
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

			// BackupJob get will fail, so only need to mock BackupRequest return
			mockTypeormCtx.manager.findOne.mockResolvedValue(dbBackupRequest);
			const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx);

			const backupRepo = new TypeormBackupRepo(typeormCtx);
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

			// Will fail before we call BackupRepo, so no need for other mocks
			mockTypeormCtx.manager.findOne.mockResolvedValue(dbBackupRequest);
			const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx);

			const backupRepo = new TypeormBackupRepo(typeormCtx);
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

		// Only test attributes in BackupRequestReplyDTO because other values are set from retrieved data in the use case
		test.each([
			{ propName: 'backupRequestId' },
			{ propName: 'storagePathName' },
			{ propName: 'backupByteCount' },
			{ propName: 'copyStartTimestamp' },
			{ propName: 'copyEndTimestamp' },
		])('when required reply attribute $propName is missing, it returns a PropsError', async ({ propName }) => {
			// Arrange

			// I need to return different results from TypeORM for different calls. Prisma
			// puts the methods on the entity type, but TypeORM puts them on the manager.
			mockTypeormCtx.manager.findOne.mockResolvedValue(null); // default return after mock once used up
			mockTypeormCtx.manager.findOne.mockResolvedValueOnce(dbBackupRequest); // first return (backup request read first)
			mockTypeormCtx.manager.findOne.mockResolvedValueOnce(null); // second return (backup read -> none found)

			// Should never call save, so no need for extra mocks
			mockTypeormCtx.manager.save.mockResolvedValue(null); // default return after mock once used up

			const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx);
			const backupRequestRepoSaveSpy = jest.spyOn(backupRequestRepo, 'save');

			const backupRepo = new TypeormBackupRepo(typeormCtx);
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
			expect(backupRequestRepoSaveSpy).not.toBeCalled();
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

			// I need to return different results from TypeORM for different calls. Prisma
			// puts the methods on the entity type, but TypeORM puts them on the manager.
			mockTypeormCtx.manager.findOne.mockResolvedValue(null); // default return after mock once used up
			mockTypeormCtx.manager.findOne.mockResolvedValueOnce(dbBackupRequest); // first return (backup request read first)
			mockTypeormCtx.manager.findOne.mockResolvedValueOnce(null); // second return (backup read second)

			mockTypeormCtx.manager.save.mockResolvedValue(null); // default return after mock once used up
			// Backup save() will fail
			mockTypeormCtx.manager.save.mockRejectedValueOnce(new TypeORMError('some save failure')); // first return (backup saved first)
			// BackupRequest save should never be called, so no extra mock needed for it

			const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx);
			const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

			const backupRepo = new TypeormBackupRepo(typeormCtx);
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
				expect((result.error as AdapterErrors.DatabaseError).functionName).toBe('TypeormBackupRepo.save');
			}
		});

		test(`when reply is Succeeded and BackupRepo.save() succeeds but BackupRequestRepo.save() fails, it returns a DatabaseError`, async () => {
			// Arrange

			// I need to return different results from TypeORM for different calls. Prisma
			// puts the methods on the entity type, but TypeORM puts them on the manager.
			mockTypeormCtx.manager.findOne.mockResolvedValue(null); // default return after mock once used up
			mockTypeormCtx.manager.findOne.mockResolvedValueOnce(dbBackupRequest); // first return (backup request read first)
			mockTypeormCtx.manager.findOne.mockResolvedValueOnce(null); // second return (backup read second -> not found, try to create)

			mockTypeormCtx.manager.save.mockResolvedValue(null); // default return after mock once used up
			mockTypeormCtx.manager.save.mockResolvedValueOnce({} as TypeormBackup); // first return (backup saved first)
			// BackupRequest save() will fail
			mockTypeormCtx.manager.save.mockRejectedValueOnce(new TypeORMError('some save failure')); // second return (backup request saved second)

			const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx);
			const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

			const backupRepo = new TypeormBackupRepo(typeormCtx);
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
				expect((result.error as AdapterErrors.DatabaseError).functionName).toBe('TypeormBackupRequestRepo.save');
			}
		});
	});

	describe('Simple updates (Backup does not exist)', () => {
		test('when reply is Succeeded and Backup does not exist, both repo save()s are called and it returns a BackupRequest (Succeeded status)', async () => {
			// Arrange

			// I need to return different results from TypeORM for different calls. Prisma
			// puts the methods on the entity type, but TypeORM puts them on the manager.
			mockTypeormCtx.manager.findOne.mockResolvedValue(null); // default return after mock once used up
			mockTypeormCtx.manager.findOne.mockResolvedValueOnce(dbBackupRequest); // first return (backup request read first)
			// Backup read returns no result for this test case, so no need for another mock

			mockTypeormCtx.manager.save.mockResolvedValue(null); // default return after mock once used up
			mockTypeormCtx.manager.save.mockResolvedValueOnce({} as TypeormBackup); // first return (backup saved first)
			// BackupRequest save() will fail
			mockTypeormCtx.manager.save.mockResolvedValueOnce({} as TypeormBackupRequest); // second return (backup request saved second)

			const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx);
			const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

			const backupRepo = new TypeormBackupRepo(typeormCtx);
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

			// I need to return different results from TypeORM for different calls. Prisma
			// puts the methods on the entity type, but TypeORM puts them on the manager.
			mockTypeormCtx.manager.findOne.mockResolvedValue(null); // default return after mock once used up
			mockTypeormCtx.manager.findOne.mockResolvedValueOnce(dbBackupRequest); // first return (backup request read first)
			mockTypeormCtx.manager.findOne.mockResolvedValueOnce(null); // second return (backup read second)

			mockTypeormCtx.manager.save.mockResolvedValue(null); // default return after mock once used up
			// Backup save should not be called for this test, so don't mock it (will mess up order of returns)
			mockTypeormCtx.manager.save.mockResolvedValueOnce({} as TypeormBackupRequest); // second return (backup request saved second)

			const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx);
			const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

			const backupRepo = new TypeormBackupRepo(typeormCtx);
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

			// If we get a second status reply for a backup request for which we've already created a Backup instance,
			// and if the backup request's status is still Sent, update the backup request.
			// This test is that case failing to update the request.

			// I need to return different results from TypeORM for different calls. Prisma
			// puts the methods on the entity type, but TypeORM puts them on the manager.
			mockTypeormCtx.manager.findOne.mockResolvedValue(null); // default return after mock once used up
			mockTypeormCtx.manager.findOne.mockResolvedValueOnce(dbBackupRequest); // first return (backup request read first)
			mockTypeormCtx.manager.findOne.mockResolvedValueOnce(dbBackup); // second return (backup read second)

			mockTypeormCtx.manager.save.mockResolvedValue(null); // default return after mock once used up
			// should not call Backup save, so no need to mock it
			// BackupRequest save() will fail
			mockTypeormCtx.manager.save.mockRejectedValueOnce(new TypeORMError('some save failure')); // second return (backup request saved second)

			const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx);
			const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

			const backupRepo = new TypeormBackupRepo(typeormCtx);
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
			expect(backupRepoSaveSpy).not.toBeCalled();
			expect(backupRequestSaveSpy).toBeCalledTimes(1);

			if (result.isErr()) {
				// type guard
				expect(result.error.name).toBe('DatabaseError');
				// ensure it fails in the BackupRequestRepo.save, not some other DatabaseError
				expect((result.error as AdapterErrors.DatabaseError).functionName).toBe('TypeormBackupRequestRepo.save');
			}
		});

		// Need to rethink this test and this part of the use case
		// Should not update the request after it is Succeeded or Failed
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

				// I need to redo this part of the use case logic and this test, but for now, get it running with TypeORM as is

				// I need to return different results from TypeORM for different calls. Prisma
				// puts the methods on the entity type, but TypeORM puts them on the manager.
				mockTypeormCtx.manager.findOne.mockResolvedValue(null); // default return after mock once used up
				// first return (backup request read first)
				mockTypeormCtx.manager.findOne.mockResolvedValueOnce({ ...dbBackupRequest, statusTypeCode: requestStatus });
				mockTypeormCtx.manager.findOne.mockResolvedValueOnce(dbBackup); // second return (backup read second)

				mockTypeormCtx.manager.save.mockResolvedValue(null); // default return after mock once used up
				// should not call Backup save because getById will return an existing backup
				mockTypeormCtx.manager.save.mockResolvedValueOnce({} as TypeormBackupRequest); // second return (backup request saved second)

				const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx);
				const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

				const backupRepo = new TypeormBackupRepo(typeormCtx);
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
