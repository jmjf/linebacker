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

describe('ReceiveStoreStatusReplyUseCase - TypeORM', () => {
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
		messageText: 'should be copied to the request (will expect)',
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

	describe('Prepare for Backup handling', () => {
		test(`when the store result's resultTypeCode is invalid, it returns a PropsError`, async () => {
			// Arrange

			// no database calls should happen, so no mocks
			const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx);
			const backupRequestRepoSaveSpy = jest.spyOn(backupRequestRepo, 'save');

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
				resultTypeCode: 'invalid',
			};

			// Act
			const result = await useCase.execute(dto);

			// Assert
			expect(result.isErr()).toBe(true);
			expect(backupRepoSaveSpy).not.toBeCalled();
			expect(backupRequestRepoSaveSpy).not.toBeCalled();
			if (result.isErr()) {
				// type guard
				expect(result.error.name).toBe('PropsError');
				expect(result.error.message).toMatch('resultTypeCode');
			}
		});

		test(`when the store result's backupRequestId is null or undefined, it returns a PropsError`, async () => {
			// Arrange

			// no database calls should happen, so no mocks
			const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx);
			const backupRequestRepoSaveSpy = jest.spyOn(backupRequestRepo, 'save');

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
				backupRequestId: undefined as unknown as string,
			};

			// Act
			const result = await useCase.execute(dto);

			// Assert
			expect(result.isErr()).toBe(true);
			expect(backupRepoSaveSpy).not.toBeCalled();
			expect(backupRequestRepoSaveSpy).not.toBeCalled();
			if (result.isErr()) {
				// type guard
				expect(result.error.name).toBe('PropsError');
				expect(result.error.message).toMatch('backupRequestId');
			}
		});

		test(`when the BackupRequest doesn't exist, it returns a NotFoundError`, async () => {
			// Arrange

			// findOne() returns null if not found, no other database calls should happen
			mockTypeormCtx.manager.findOne.mockResolvedValue(null);
			const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx);
			const backupRequestRepoSaveSpy = jest.spyOn(backupRequestRepo, 'save');

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
			expect(backupRequestRepoSaveSpy).not.toBeCalled();
			if (result.isErr()) {
				// type guard
				expect(result.error.name).toBe('NotFoundError');
				expect(result.error.message).toMatch(dto.backupRequestId);
			}
		});

		test(`when the BackupRequest get fails (rejects), it returns a DatabaseError`, async () => {
			// Arrange

			// findOne() returns null if not found, no other database calls should happen
			mockTypeormCtx.manager.findOne.mockRejectedValue(new Error('simulated database error'));
			const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx);
			const backupRequestRepoSaveSpy = jest.spyOn(backupRequestRepo, 'save');

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
			};

			// Act
			const result = await useCase.execute(dto);

			// Assert
			expect(result.isErr()).toBe(true);
			expect(backupRepoSaveSpy).not.toBeCalled();
			expect(backupRequestRepoSaveSpy).not.toBeCalled();
			if (result.isErr()) {
				// type guard
				expect(result.error.name).toBe('DatabaseError');
			}
		});

		test(`when the BackupJob doesn't exist, it returns a BackupJobServiceError`, async () => {
			// Arrange

			// BackupJob get will fail, so only need to mock BackupRequest return
			mockTypeormCtx.manager.findOne.mockResolvedValue(dbBackupRequest);
			const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx);
			const backupRequestRepoSaveSpy = jest.spyOn(backupRequestRepo, 'save');

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
			expect(backupRequestRepoSaveSpy).not.toBeCalled();
			if (result.isErr()) {
				// type guard
				expect(result.error.name).toBe('BackupJobServiceError');
				// future, test message
			}
		});

		test('when Backup get fails (rejects), it returns a DatabaseError', async () => {
			// Arrange

			// BackupRequest read will succeed, Backup read will fail
			mockTypeormCtx.manager.findOne.mockResolvedValueOnce(dbBackupRequest);
			mockTypeormCtx.manager.findOne.mockRejectedValueOnce(new Error('simulated Backup database error'));
			const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx);
			const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

			const backupRepo = new TypeormBackupRepo(typeormCtx);
			const backupRepoGetSpy = jest.spyOn(backupRepo, 'getByBackupRequestId');
			const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');

			const backupJobServiceAdapter = new MockBackupJobServiceAdapter({
				getByIdResult: { ...backupJobDTO },
			});

			const useCase = new ReceiveStoreStatusReplyUseCase({
				backupRequestRepo,
				backupRepo,
				backupJobServiceAdapter,
			});
			const dto = {
				...createBackupReply,
				backupRequestId: `read Backup database error`,
			};

			// Act
			const result = await useCase.execute(dto);

			// Assert
			expect(result.isErr()).toBe(true);
			expect(backupRepoGetSpy).toBeCalledTimes(1);
			expect(backupRepoSaveSpy).not.toBeCalled();
			expect(backupRequestSaveSpy).not.toBeCalled();
			if (result.isErr()) {
				// type guard
				expect(result.error.name).toBe('DatabaseError');
				// DatabaseError includes details about what failed, so let's be extra sure it failed where expected
				// backupRepoGetSpy should be enough, but this check gives extra certainty
				expect((result.error as AdapterErrors.DatabaseError).functionName).toContain(
					'BackupRepo.getByBackupRequestId'
				);
			}
		});
	});

	describe('Backup create and save error handling (Backup not found, store result Succeeded)', () => {
		/**
		 * Reply must be Succeeded to create and save Backup, so Failed tests aren't valid here.
		 * Tests for Failed status in Backup Request tests will ensure Backup save isn't called.
		 **/

		// Only test attributes in BackupRequestReplyDTO because other values are set from retrieved data in the use case
		test.each([
			// backupRequestId checked in 'Prepare for Backup handling'
			{ propName: 'storagePathName' },
			{ propName: 'backupByteCount' },
			{ propName: 'copyStartTimestamp' },
			{ propName: 'copyEndTimestamp' },
		])(
			'when store result $propName is missing, it returns a PropsError (Backup.create() fails)',
			async ({ propName }) => {
				// Arrange

				// BackupRequest read succeeds, Backup read returns not found
				mockTypeormCtx.manager.findOne.mockResolvedValueOnce(dbBackupRequest);
				mockTypeormCtx.manager.findOne.mockResolvedValueOnce(null);

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
			}
		);

		test('when Backup save fails (rejects), it returns a DatabaseError', async () => {
			// Arrange

			// BackupRequest read will succeed, Backup read will return not found
			mockTypeormCtx.manager.findOne.mockResolvedValueOnce(dbBackupRequest); // 1st return -> BackupRequest
			mockTypeormCtx.manager.findOne.mockResolvedValueOnce(null); // 2nd return -> Backup not found (good)
			const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx);
			const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

			// Backup save failure
			mockTypeormCtx.manager.save.mockRejectedValueOnce(new Error('simulate Backup database error'));
			const backupRepo = new TypeormBackupRepo(typeormCtx);
			const backupRepoGetSpy = jest.spyOn(backupRepo, 'getByBackupRequestId');
			const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');

			const backupJobServiceAdapter = new MockBackupJobServiceAdapter({
				getByIdResult: { ...backupJobDTO },
			});

			const useCase = new ReceiveStoreStatusReplyUseCase({
				backupRequestRepo,
				backupRepo,
				backupJobServiceAdapter,
			});
			const dto = {
				...createBackupReply,
				backupRequestId: `save Backup database error`,
			};

			// Act
			const result = await useCase.execute(dto);

			// Assert
			expect(result.isErr()).toBe(true);
			expect(backupRepoGetSpy).toBeCalledTimes(1);
			expect(backupRepoSaveSpy).toBeCalledTimes(1);
			expect(backupRequestSaveSpy).not.toBeCalled();
			if (result.isErr()) {
				// type guard
				expect(result.error.name).toBe('DatabaseError');
				// DatabaseError includes details about what failed, so let's be extra sure it failed where expected
				// backupRepoGetSpy should be enough, but this check gives extra certainty
				expect((result.error as AdapterErrors.DatabaseError).functionName).toContain('BackupRepo.save');
			}
		});
	});

	describe('Backup Request save error handling', () => {
		test('when Backup not found and Backup Request save fails (rejects), it returns a DatabaseError', async () => {
			// Arrange

			// BackupRequest read will succeed, Backup read will return not found
			mockTypeormCtx.manager.findOne.mockResolvedValueOnce(dbBackupRequest); // 1st return -> BackupRequest
			mockTypeormCtx.manager.findOne.mockResolvedValueOnce(null); // 2nd return -> Backup not found (good)
			// Backup save will succeed, Backup Request save will fail
			mockTypeormCtx.manager.save.mockResolvedValueOnce({} as TypeormBackup); // Backup save succeeds
			mockTypeormCtx.manager.save.mockRejectedValueOnce(new Error('simulate Backup Request database error'));

			const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx);
			const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

			// Backup save failure
			const backupRepo = new TypeormBackupRepo(typeormCtx);
			const backupRepoGetSpy = jest.spyOn(backupRepo, 'getByBackupRequestId');
			const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');

			const backupJobServiceAdapter = new MockBackupJobServiceAdapter({
				getByIdResult: { ...backupJobDTO },
			});

			const useCase = new ReceiveStoreStatusReplyUseCase({
				backupRequestRepo,
				backupRepo,
				backupJobServiceAdapter,
			});
			const dto = {
				...createBackupReply,
				backupRequestId: `save Backup database error`,
			};

			// Act
			const result = await useCase.execute(dto);

			// Assert
			expect(result.isErr()).toBe(true);
			expect(backupRepoGetSpy).toBeCalledTimes(1);
			expect(backupRepoSaveSpy).toBeCalledTimes(1);
			expect(backupRequestSaveSpy).toBeCalledTimes(1);
			if (result.isErr()) {
				// type guard
				expect(result.error.name).toBe('DatabaseError');
				// DatabaseError includes details about what failed, so let's be extra sure it failed where expected
				// backupRepoGetSpy should be enough, but this check gives extra certainty
				expect((result.error as AdapterErrors.DatabaseError).functionName).toContain('BackupRequestRepo.save');
			}
		});

		test('when Backup found and Backup Request save fails (rejects), it returns a DatabaseError', async () => {
			// Arrange

			// BackupRequest read will succeed, Backup read will succeed
			mockTypeormCtx.manager.findOne.mockResolvedValueOnce(dbBackupRequest); // 1st return -> BackupRequest
			mockTypeormCtx.manager.findOne.mockResolvedValueOnce(dbBackup); // 2nd return -> Backup not found (good)
			// Backup save not called because found, Backup Request save will fail
			// mockTypeormCtx.manager.save.mockResolvedValueOnce({} as TypeormBackup); // Backup save succeeds
			mockTypeormCtx.manager.save.mockRejectedValueOnce(new Error('simulate Backup Request database error'));

			const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx);
			const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

			// Backup save failure
			const backupRepo = new TypeormBackupRepo(typeormCtx);
			const backupRepoGetSpy = jest.spyOn(backupRepo, 'getByBackupRequestId');
			const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');

			const backupJobServiceAdapter = new MockBackupJobServiceAdapter({
				getByIdResult: { ...backupJobDTO },
			});

			const useCase = new ReceiveStoreStatusReplyUseCase({
				backupRequestRepo,
				backupRepo,
				backupJobServiceAdapter,
			});
			const dto = {
				...createBackupReply,
				backupRequestId: `save Backup database error`,
			};

			// Act
			const result = await useCase.execute(dto);

			// Assert
			expect(result.isErr()).toBe(true);
			expect(backupRepoGetSpy).toBeCalledTimes(1);
			expect(backupRepoSaveSpy).not.toBeCalled();
			expect(backupRequestSaveSpy).toBeCalledTimes(1);
			if (result.isErr()) {
				// type guard
				expect(result.error.name).toBe('DatabaseError');
				// DatabaseError includes details about what failed, so let's be extra sure it failed where expected
				// backupRepoGetSpy should be enough, but this check gives extra certainty
				expect((result.error as AdapterErrors.DatabaseError).functionName).toContain('BackupRequestRepo.save');
			}
		});
	});

	describe('Backup Request save ok handling (includes duplicate replies and partial update retries)', () => {
		describe('Backup not found', () => {
			// Backup not found, store Failed -> Request saved sometimes, Backup saved never
			// Proves Request status updates only when not completed
			// Proves store Failed does not create Backup
			test.each([
				{
					storeResult: StoreResultTypeValues.Failed,
					backupRequestStatus: RequestStatusTypeValues.Sent,
					backupRequestReplyTimestamp: undefined,
					expectedBackupSaveCalls: 0,
					expectedRequestSaveCalls: 1,
					expectedRequestStatus: RequestStatusTypeValues.Failed,
				},
				{
					storeResult: StoreResultTypeValues.Failed,
					backupRequestStatus: RequestStatusTypeValues.Failed,
					backupRequestReplyTimestamp: new Date(),
					expectedBackupSaveCalls: 0,
					expectedRequestSaveCalls: 0,
					expectedRequestStatus: RequestStatusTypeValues.Failed,
				},
				// Next 2 cases mean someone meddled with data -- Request status inconsistent with other data
				{
					storeResult: StoreResultTypeValues.Failed,
					backupRequestStatus: RequestStatusTypeValues.Succeeded,
					backupRequestReplyTimestamp: new Date(),
					expectedBackupSaveCalls: 0,
					expectedRequestSaveCalls: 1,
					expectedRequestStatus: RequestStatusTypeValues.Failed,
				},
				{
					// test an out of order status; store result means it was sent
					storeResult: StoreResultTypeValues.Failed,
					backupRequestStatus: RequestStatusTypeValues.Allowed,
					backupRequestReplyTimestamp: undefined,
					expectedBackupSaveCalls: 0,
					expectedRequestSaveCalls: 1,
					expectedRequestStatus: RequestStatusTypeValues.Failed,
				},
			])(
				`when store result is $storeResult, BackupRequest is $backupRequestStatus, it sets BackupRequest status $expectedRequestStatus, saves $expectedRequestSaveCalls`,
				async ({
					storeResult,
					backupRequestStatus,
					backupRequestReplyTimestamp,
					expectedBackupSaveCalls,
					expectedRequestSaveCalls,
					expectedRequestStatus,
				}) => {
					// Arrange

					// BackupRequest read will succeed, Backup read will return not found
					mockTypeormCtx.manager.findOne.mockResolvedValueOnce({
						...dbBackupRequest,
						statusTypeCode: backupRequestStatus,
						replyTimestamp: backupRequestReplyTimestamp,
					} as TypeormBackupRequest); // 1st return -> BackupRequest
					mockTypeormCtx.manager.findOne.mockResolvedValueOnce(null); // 2nd return -> Backup not found (good)

					// Backup save not called, Backup Request save will succeed if called
					// mockTypeormCtx.manager.save.mockResolvedValueOnce({} as TypeormBackup);
					mockTypeormCtx.manager.save.mockResolvedValueOnce({} as TypeormBackupRequest);

					const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx);
					const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

					// Backup save failure
					const backupRepo = new TypeormBackupRepo(typeormCtx);
					const backupRepoGetSpy = jest.spyOn(backupRepo, 'getByBackupRequestId');
					const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');

					const backupJobServiceAdapter = new MockBackupJobServiceAdapter({
						getByIdResult: { ...backupJobDTO },
					});

					const useCase = new ReceiveStoreStatusReplyUseCase({
						backupRequestRepo,
						backupRepo,
						backupJobServiceAdapter,
					});
					const dto = {
						...createBackupReply,
						backupRequestId: `storeResult ${storeResult} | backupRequestStatus ${backupRequestStatus}`,
						resultTypeCode: storeResult,
					};

					// Act
					const startTime = new Date();
					const result = await useCase.execute(dto);
					const endTime = new Date();

					// Assert
					expect(result.isOk()).toBe(true);
					expect(backupRepoGetSpy).toBeCalledTimes(1);
					expect(backupRepoSaveSpy).toBeCalledTimes(expectedBackupSaveCalls);
					expect(backupRequestSaveSpy).toBeCalledTimes(expectedRequestSaveCalls);
					if (result.isOk()) {
						expect(result.value.statusTypeCode).toBe(expectedRequestStatus);
						if (expectedRequestSaveCalls > 0) {
							expect(result.value.replyTimestamp.valueOf()).toBeGreaterThanOrEqual(startTime.valueOf());
							expect(result.value.replyTimestamp.valueOf()).toBeLessThanOrEqual(endTime.valueOf());
							expect(result.value.replyMessageText).toBe(createBackupReply.messageText);
						}
					}
				}
			);

			// Backup not found, store Succeeded -> Backup and Request saved always
			// Proves we always create the backup on store Succeeded if not found
			// Proves we always update Request when Backup saved
			test.each([
				{
					storeResult: StoreResultTypeValues.Succeeded,
					backupRequestStatus: RequestStatusTypeValues.Sent,
					backupRequestReplyTimestamp: undefined,
					expectedBackupSaveCalls: 1,
					expectedRequestSaveCalls: 1,
					expectedRequestStatus: RequestStatusTypeValues.Succeeded,
				},
				{
					storeResult: StoreResultTypeValues.Succeeded,
					backupRequestStatus: RequestStatusTypeValues.Failed,
					backupRequestReplyTimestamp: new Date(),
					expectedBackupSaveCalls: 1,
					expectedRequestSaveCalls: 1,
					expectedRequestStatus: RequestStatusTypeValues.Succeeded,
				},
				// These 2 cases mean someone meddled with data -- Request status inconsistent with other data
				{
					storeResult: StoreResultTypeValues.Succeeded,
					backupRequestStatus: RequestStatusTypeValues.Succeeded,
					backupRequestReplyTimestamp: new Date(),
					expectedBackupSaveCalls: 1,
					expectedRequestSaveCalls: 1,
					expectedRequestStatus: RequestStatusTypeValues.Succeeded,
				},
				{
					// test an out of order status; store result means it got sent somehow
					storeResult: StoreResultTypeValues.Succeeded,
					backupRequestStatus: RequestStatusTypeValues.Allowed,
					backupRequestReplyTimestamp: undefined,
					expectedBackupSaveCalls: 1,
					expectedRequestSaveCalls: 1,
					expectedRequestStatus: RequestStatusTypeValues.Succeeded,
				},
			])(
				`when store result is $storeResult, BackupRequest is $backupRequestStatus, it sets BackupRequest status $expectedRequestStatus, saves Backup and BackupRequest`,
				async ({
					storeResult,
					backupRequestStatus,
					backupRequestReplyTimestamp,
					expectedBackupSaveCalls,
					expectedRequestSaveCalls,
					expectedRequestStatus,
				}) => {
					// Arrange

					// BackupRequest read will succeed
					mockTypeormCtx.manager.findOne.mockResolvedValueOnce({
						...dbBackupRequest,
						statusTypeCode: backupRequestStatus,
						replyTimestamp: backupRequestReplyTimestamp,
					} as TypeormBackupRequest);
					// Backup read will return not found
					mockTypeormCtx.manager.findOne.mockResolvedValueOnce(null);

					// Backup save will succeed, Backup Request save will succeed
					mockTypeormCtx.manager.save.mockResolvedValueOnce({} as TypeormBackup);
					mockTypeormCtx.manager.save.mockResolvedValueOnce({} as TypeormBackupRequest);

					const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx);
					const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

					// Backup save failure
					const backupRepo = new TypeormBackupRepo(typeormCtx);
					const backupRepoGetSpy = jest.spyOn(backupRepo, 'getByBackupRequestId');
					const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');

					const backupJobServiceAdapter = new MockBackupJobServiceAdapter({
						getByIdResult: { ...backupJobDTO },
					});

					const useCase = new ReceiveStoreStatusReplyUseCase({
						backupRequestRepo,
						backupRepo,
						backupJobServiceAdapter,
					});
					const dto = {
						...createBackupReply,
						backupRequestId: `storeResult ${storeResult} | backupRequestStatus ${backupRequestStatus}`,
						resultTypeCode: storeResult,
					};

					// Act
					const startTime = new Date();
					const result = await useCase.execute(dto);
					const endTime = new Date();

					// Assert
					expect(result.isOk()).toBe(true);
					expect(backupRepoGetSpy).toBeCalledTimes(1);
					expect(backupRepoSaveSpy).toBeCalledTimes(expectedBackupSaveCalls);
					expect(backupRequestSaveSpy).toBeCalledTimes(expectedRequestSaveCalls);
					if (result.isOk()) {
						expect(result.value.statusTypeCode).toBe(expectedRequestStatus);
						expect(result.value.replyTimestamp.valueOf()).toBeGreaterThanOrEqual(startTime.valueOf());
						expect(result.value.replyTimestamp.valueOf()).toBeLessThanOrEqual(endTime.valueOf());
						expect(result.value.replyMessageText).toBe(createBackupReply.messageText);
					}
				}
			);
		});
		describe('Backup found', () => {
			// Backup found, Request already Succeeded -> neither save called
			// Proves we ignore updates after Request succeeds if backup found
			test.each([
				// expectedBackupSaveCalls 0, expectedRequestSaveCalls 0
				{
					storeResult: StoreResultTypeValues.Failed,
				},
				{
					storeResult: StoreResultTypeValues.Succeeded,
				},
			])(
				`when store result is $storeResult, BackupRequest is Succeeded, it saves nothing, BackupRequest status is Succeeded`,
				async ({ storeResult }) => {
					// Arrange

					// BackupRequest read will succeed, Backup read will return found Backup
					mockTypeormCtx.manager.findOne.mockResolvedValueOnce({
						...dbBackupRequest,
						statusTypeCode: RequestStatusTypeValues.Succeeded,
						replyTimestamp: new Date(),
					} as TypeormBackupRequest);
					mockTypeormCtx.manager.findOne.mockResolvedValueOnce(dbBackup);

					// Backup save not called (because found), Backup Request save will succeed
					// mockTypeormCtx.manager.save.mockResolvedValueOnce({} as TypeormBackup);
					mockTypeormCtx.manager.save.mockResolvedValueOnce({} as TypeormBackupRequest);

					const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx);
					const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

					const backupRepo = new TypeormBackupRepo(typeormCtx);
					const backupRepoGetSpy = jest.spyOn(backupRepo, 'getByBackupRequestId');
					const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');

					const backupJobServiceAdapter = new MockBackupJobServiceAdapter({
						getByIdResult: { ...backupJobDTO },
					});

					const useCase = new ReceiveStoreStatusReplyUseCase({
						backupRequestRepo,
						backupRepo,
						backupJobServiceAdapter,
					});
					const dto = {
						...createBackupReply,
						backupRequestId: `storeResult ${storeResult} | backupRequestStatus Succeeded`,
						resultTypeCode: storeResult,
					};

					// Act
					const result = await useCase.execute(dto);

					// Assert
					expect(result.isOk()).toBe(true);
					expect(backupRepoGetSpy).toBeCalledTimes(1);
					expect(backupRepoSaveSpy).toBeCalledTimes(0);
					expect(backupRequestSaveSpy).toBeCalledTimes(0);
					if (result.isOk()) {
						expect(result.value.statusTypeCode).toBe(RequestStatusTypeValues.Succeeded);
						// Request save not called, so can't expect
					}
				}
			);

			// Backup found, Request not Succeeded -> Request saved
			// Proves we set Request to Succeeded if backup found always (Backup exists overrules store status)
			// These cases suggest someone meddled with data
			test.each([
				// expectedBackupSaveCalls always 0, expectedRequestSaveCalls always 1
				{
					storeResult: StoreResultTypeValues.Failed,
					backupRequestStatus: RequestStatusTypeValues.Sent,
					expectedRequestStatus: RequestStatusTypeValues.Succeeded,
				},
				{
					storeResult: StoreResultTypeValues.Failed,
					backupRequestStatus: RequestStatusTypeValues.Failed,
					expectedRequestStatus: RequestStatusTypeValues.Succeeded,
				},
				{
					// test an out of order status here; Backup found always wins
					storeResult: StoreResultTypeValues.Succeeded,
					backupRequestStatus: RequestStatusTypeValues.Allowed,
					expectedRequestStatus: RequestStatusTypeValues.Succeeded,
				},
				{
					storeResult: StoreResultTypeValues.Succeeded,
					backupRequestStatus: RequestStatusTypeValues.Failed,
					expectedRequestStatus: RequestStatusTypeValues.Succeeded,
				},
			])(
				`when store result is $storeResult, BackupRequest is $backupRequestStatus, it saves the BackupRequest with status $expectedRequestStatus`,
				async ({ storeResult, backupRequestStatus, expectedRequestStatus }) => {
					// Arrange

					// BackupRequest read will succeed, Backup read will return found Backup
					mockTypeormCtx.manager.findOne.mockResolvedValueOnce({
						...dbBackupRequest,
						statusTypeCode: backupRequestStatus,
					} as TypeormBackupRequest);
					mockTypeormCtx.manager.findOne.mockResolvedValueOnce(dbBackup);

					// Backup save not called (because found), Backup Request save will succeed
					// mockTypeormCtx.manager.save.mockResolvedValueOnce({} as TypeormBackup);
					mockTypeormCtx.manager.save.mockResolvedValueOnce({} as TypeormBackupRequest);

					const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx);
					const backupRequestSaveSpy = jest.spyOn(backupRequestRepo, 'save');

					const backupRepo = new TypeormBackupRepo(typeormCtx);
					const backupRepoGetSpy = jest.spyOn(backupRepo, 'getByBackupRequestId');
					const backupRepoSaveSpy = jest.spyOn(backupRepo, 'save');

					const backupJobServiceAdapter = new MockBackupJobServiceAdapter({
						getByIdResult: { ...backupJobDTO },
					});

					const useCase = new ReceiveStoreStatusReplyUseCase({
						backupRequestRepo,
						backupRepo,
						backupJobServiceAdapter,
					});
					const dto = {
						...createBackupReply,
						backupRequestId: `storeResult ${storeResult} | backupRequestStatus ${backupRequestStatus}`,
						resultTypeCode: storeResult,
					};

					// Act
					const startTime = new Date();
					const result = await useCase.execute(dto);
					const endTime = new Date();

					// Assert
					expect(result.isOk()).toBe(true);
					expect(backupRepoGetSpy).toBeCalledTimes(1);
					expect(backupRepoSaveSpy).toBeCalledTimes(0);
					expect(backupRequestSaveSpy).toBeCalledTimes(1);
					if (result.isOk()) {
						expect(result.value.statusTypeCode).toBe(expectedRequestStatus);
						expect(result.value.replyTimestamp.valueOf()).toBeGreaterThanOrEqual(startTime.valueOf());
						expect(result.value.replyTimestamp.valueOf()).toBeLessThanOrEqual(endTime.valueOf());
						expect(result.value.replyMessageText).toBe(createBackupReply.messageText);
					}
				}
			);
		});
	});
});
