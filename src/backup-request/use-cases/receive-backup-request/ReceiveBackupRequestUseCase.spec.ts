import * as bullMq from 'bullmq';
jest.mock('bullmq');

import { ok } from '../../../common/core/Result';
import {
	createMockTypeormContext,
	MockTypeormContext,
	TypeormContext,
} from '../../../infrastructure/typeorm/typeormContext';
import { CircuitBreakerWithRetry } from '../../../infrastructure/resilience/CircuitBreakerWithRetry';
import { getLenientCircuitBreaker } from '../../../test-helpers/circuitBreakerHelpers';

import { TypeormBackupRequestRepo } from '../../adapter/impl/TypeormBackupRequestRepo';
import { ReceiveBackupRequestDTO, ReceiveBackupRequestUseCase } from './ReceiveBackupRequestUseCase';
import { RequestTransportType } from '../../domain/RequestTransportType';
import { TypeormBackupRequest } from '../../../infrastructure/typeorm/entity/TypeormBackupRequest.entity';
import { BackupRequestStatusTypeValues } from '../../domain/BackupRequestStatusType';
import { BmqBackupRequestEventBus } from '../../adapter/BullMqImpl/BmqBackupRequestEventBus';
import { bullMqConnection } from '../../../infrastructure/bullmq/bullMqInfra';

describe('ReceiveBackupRequestUseCase', () => {
	let mockTypeormCtx: MockTypeormContext;
	let typeormCtx: TypeormContext;
	let circuitBreaker: CircuitBreakerWithRetry;
	let abortController: AbortController;
	const mockBullMq = jest.mocked(bullMq);

	beforeEach(() => {
		mockTypeormCtx = createMockTypeormContext();
		typeormCtx = mockTypeormCtx as unknown as TypeormContext;

		const isAlive = () => {
			return Promise.resolve(ok(true));
		};
		abortController = new AbortController();
		circuitBreaker = getLenientCircuitBreaker('Typeorm', abortController.signal);

		mockBullMq.Queue.mockClear();
	});

	afterEach(() => {
		circuitBreaker.halt();
	});

	const baseDto: ReceiveBackupRequestDTO = {
		backupRequestId: 'backup-request-id',
		backupJobId: 'backup-job-id',
		dataDate: new Date('2022-05-01T01:02:03.456Z'),
		preparedDataPathName: '/prepared/data/path/name',
		getOnStartFlag: true,
		transportTypeCode: 'HTTP',
		statusTypeCode: 'Accepted',
		receivedTimestamp: new Date('2022-05-30T07:08:09.101Z'),
		requesterId: 'requester-id',
	};

	describe('Precondition checks', () => {
		test('when the database read fails, it returns a DatabaseError', async () => {
			mockTypeormCtx.manager.findOne.mockRejectedValue(new Error('mock database error'));
			const brRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreaker);
			const brSaveSpy = jest.spyOn(brRepo, 'save');

			const bmqBus = new BmqBackupRequestEventBus(bullMq, bullMqConnection);
			const bmqAddSpy = jest.spyOn(bmqBus, 'publish');

			const useCase = new ReceiveBackupRequestUseCase(brRepo, bmqBus);

			const result = await useCase.execute({ ...baseDto });

			expect(result.isErr()).toBe(true);
			expect(brSaveSpy).not.toHaveBeenCalled();
			expect(bmqAddSpy).not.toHaveBeenCalled();
			if (result.isErr()) {
				expect(result.error.name).toEqual('DatabaseError');
			}
		});

		test(`when the request doesn't exist and data is bad, it returns a PropsError`, async () => {
			mockTypeormCtx.manager.findOne.mockResolvedValue(null);
			const brRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreaker);
			const brSaveSpy = jest.spyOn(brRepo, 'save');

			const bmqBus = new BmqBackupRequestEventBus(bullMq, bullMqConnection);
			const bmqAddSpy = jest.spyOn(bmqBus, 'publish');

			const useCase = new ReceiveBackupRequestUseCase(brRepo, bmqBus);

			const result = await useCase.execute({
				...baseDto,
				transportTypeCode: 'INVALID' as RequestTransportType, // coerce type to force failure
			});

			expect(result.isErr()).toBe(true);
			expect(brSaveSpy).not.toHaveBeenCalled();
			expect(bmqAddSpy).not.toHaveBeenCalled();
			if (result.isErr()) {
				expect(result.error.name).toEqual('PropsError');
			}
		});
	});

	describe('Request not found', () => {
		test(`when the request doesn't exist and save fails, it returns a DatabaseError`, async () => {
			mockTypeormCtx.manager.findOne.mockResolvedValue(null);
			mockTypeormCtx.manager.save.mockRejectedValue(new Error('mock database error'));
			const brRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreaker);
			const brSaveSpy = jest.spyOn(brRepo, 'save');

			const bmqBus = new BmqBackupRequestEventBus(bullMq, bullMqConnection);
			const bmqAddSpy = jest.spyOn(bmqBus, 'publish');

			const useCase = new ReceiveBackupRequestUseCase(brRepo, bmqBus);

			const result = await useCase.execute({ ...baseDto });

			expect(result.isErr()).toBe(true);
			expect(brSaveSpy).toHaveBeenCalledTimes(1);
			expect(bmqAddSpy).not.toHaveBeenCalled();
			if (result.isErr()) {
				expect(result.error.name).toEqual('DatabaseError');
			}
		});

		test(`when the request doesn't exist and publish fails, it saves but returns a EventBusError`, async () => {
			mockTypeormCtx.manager.findOne.mockResolvedValue(null);
			mockTypeormCtx.manager.save.mockResolvedValue({});
			const brRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreaker);
			const brSaveSpy = jest.spyOn(brRepo, 'save');

			mockBullMq.Queue.prototype.add.mockRejectedValue(new Error('mock event bus error'));
			const bmqBus = new BmqBackupRequestEventBus(bullMq, bullMqConnection);
			const bmqAddSpy = jest.spyOn(bmqBus, 'publish');

			const useCase = new ReceiveBackupRequestUseCase(brRepo, bmqBus);

			const result = await useCase.execute({ ...baseDto });

			expect(result.isErr()).toBe(true);
			expect(brSaveSpy).toHaveBeenCalledTimes(1);
			expect(bmqAddSpy).toHaveBeenCalledTimes(1);
			if (result.isErr()) {
				expect(result.error.name).toEqual('EventBusError');
				expect((result.error.errorData as any).functionName).toEqual('publish');
			}
		});

		test(`when the request doesn't exist and publish succeeds, it saves, publishes and returns ok`, async () => {
			mockTypeormCtx.manager.findOne.mockResolvedValue(null);
			mockTypeormCtx.manager.save.mockResolvedValue({});
			const brRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreaker);
			const brSaveSpy = jest.spyOn(brRepo, 'save');

			mockBullMq.Queue.prototype.add.mockResolvedValue({} as bullMq.Job);
			const bmqBus = new BmqBackupRequestEventBus(bullMq, bullMqConnection);
			const bmqAddSpy = jest.spyOn(bmqBus, 'publish');

			const useCase = new ReceiveBackupRequestUseCase(brRepo, bmqBus);

			const result = await useCase.execute({ ...baseDto });

			expect(result.isOk()).toBe(true);
			expect(brSaveSpy).toHaveBeenCalledTimes(1);
			expect(bmqAddSpy).toHaveBeenCalledTimes(1);
			if (result.isOk()) {
				expect(result.value.backupRequestId.value).toEqual(baseDto.backupRequestId);
				expect(result.value.statusTypeCode).toEqual(BackupRequestStatusTypeValues.Received);
			}
		});
	});

	describe('Request found', () => {
		test(`when the request exists and status is not Received, it returns a PropsError`, async () => {
			mockTypeormCtx.manager.findOne.mockResolvedValue({
				...baseDto,
				statusTypeCode: 'INVALID',
			} as TypeormBackupRequest);
			const brRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreaker);
			const brSaveSpy = jest.spyOn(brRepo, 'save');

			const bmqBus = new BmqBackupRequestEventBus(bullMq, bullMqConnection);
			const bmqAddSpy = jest.spyOn(bmqBus, 'publish');

			const useCase = new ReceiveBackupRequestUseCase(brRepo, bmqBus);

			const result = await useCase.execute({ ...baseDto });

			expect(result.isErr()).toBe(true);
			expect(brSaveSpy).not.toHaveBeenCalled();
			expect(bmqAddSpy).not.toHaveBeenCalled();
			if (result.isErr()) {
				expect(result.error.name).toEqual('PropsError');
				expect((result.error.errorData as any).statusTypeCode).toBe('INVALID');
				expect((result.error.errorData as any).expectedStatusTypeCode).toBe(BackupRequestStatusTypeValues.Received);
			}
		});

		test(`when the request exists and publish fails, it does not save but returns a EventBusError`, async () => {
			mockTypeormCtx.manager.findOne.mockResolvedValue({
				...baseDto,
				statusTypeCode: BackupRequestStatusTypeValues.Received,
			} as TypeormBackupRequest);
			mockTypeormCtx.manager.save.mockResolvedValue({});
			const brRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreaker);
			const brSaveSpy = jest.spyOn(brRepo, 'save');

			mockBullMq.Queue.prototype.add.mockRejectedValue(new Error('mock event bus error'));
			const bmqBus = new BmqBackupRequestEventBus(bullMq, bullMqConnection);
			const bmqAddSpy = jest.spyOn(bmqBus, 'publish');

			const useCase = new ReceiveBackupRequestUseCase(brRepo, bmqBus);

			const result = await useCase.execute({ ...baseDto });

			expect(result.isErr()).toBe(true);
			expect(brSaveSpy).not.toHaveBeenCalled();
			expect(bmqAddSpy).toHaveBeenCalledTimes(1);
			if (result.isErr()) {
				expect(result.error.name).toEqual('EventBusError');
				expect((result.error.errorData as any).functionName).toEqual('publish');
			}
		});

		test(`when the request exists and publish succeeds, it doesn't save, publishes and returns ok`, async () => {
			mockTypeormCtx.manager.findOne.mockResolvedValue({
				...baseDto,
				statusTypeCode: BackupRequestStatusTypeValues.Received,
			} as TypeormBackupRequest);
			mockTypeormCtx.manager.save.mockResolvedValue({});
			const brRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreaker);
			const brSaveSpy = jest.spyOn(brRepo, 'save');

			mockBullMq.Queue.prototype.add.mockResolvedValue({} as bullMq.Job);
			const bmqBus = new BmqBackupRequestEventBus(bullMq, bullMqConnection);
			const bmqAddSpy = jest.spyOn(bmqBus, 'publish');

			const useCase = new ReceiveBackupRequestUseCase(brRepo, bmqBus);

			const result = await useCase.execute({ ...baseDto });

			expect(result.isOk()).toBe(true);
			expect(brSaveSpy).not.toHaveBeenCalled();
			expect(bmqAddSpy).toHaveBeenCalledTimes(1);
			if (result.isOk()) {
				expect(result.value.backupRequestId.value).toEqual(baseDto.backupRequestId);
				expect(result.value.statusTypeCode).toEqual(BackupRequestStatusTypeValues.Received);
			}
		});
	});
});
