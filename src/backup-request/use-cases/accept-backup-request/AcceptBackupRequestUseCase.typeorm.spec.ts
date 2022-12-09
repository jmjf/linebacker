// mock bullmq (event bus)
jest.mock('bullmq');
import * as bullMq from 'bullmq';

import { appState } from '../../../infrastructure/app-state/appState';
appState.eventBus_type = 'bullmq';

import { eventBus } from '../../../common/infrastructure/event-bus/eventBus';

import { AcceptBackupRequestDTO, AcceptBackupRequestUseCase } from './AcceptBackupRequestUseCase';
import { RequestTransportTypeValues } from '../../domain/RequestTransportType';

import { EventBusError } from '../../../common/infrastructure/InfrastructureErrors';
import { BackupRequest } from '../../domain/BackupRequest';

describe('AcceptBackupRequestUseCase - bullmq', () => {
	const mockBullMq = jest.mocked(bullMq);
	const eventBusPublishSpy = jest.spyOn(eventBus, 'publishEvent');

	beforeEach(() => {
		mockBullMq.Queue.mockClear();
		eventBusPublishSpy.mockClear();
	});

	afterEach(() => {
		//
	});

	const baseDto = {
		apiVersion: '2022-01-01',
		backupJobId: 'b753d695-c9e1-4fa1-99f0-9fc025fca24c',
		dataDate: '2022-01-31',
		backupDataLocation: '/path/to/data',
		transportType: RequestTransportTypeValues.HTTP,
		getOnStartFlag: true,
	} as AcceptBackupRequestDTO;

	test('when executed with an invalid transport type, it returns the expected error', async () => {
		// Arrange
		// this test fails before it calls the event bus, so no need to mock add
		const eventBusPublishSpy = jest.spyOn(eventBus, 'publishEvent');

		const useCase = new AcceptBackupRequestUseCase(eventBus);
		const dto = { ...baseDto, transportType: 'BadTransport' };

		// Act
		const result = await useCase.execute(dto);

		// Assert
		expect(result.isErr()).toBe(true);
		expect(eventBusPublishSpy).not.toHaveBeenCalled();
		if (result.isErr()) {
			// type guard
			expect(result.error.message).toContain('is not one of');
			expect((result.error.errorData as any).argName).toBe('transportType');
		}
	});

	test.each([
		{ propName: 'backupJobId', errPropName: 'backupJobId' },
		{ propName: 'dataDate', errPropName: 'dataDate' },
		{ propName: 'backupDataLocation', errPropName: 'preparedDataPathName' },
		{ propName: 'transportType', errPropName: 'transportTypeCode' },
		{ propName: 'getOnStartFlag', errPropName: 'getOnStartFlag' },
	])('when executed with $propName undefined, it returns the expected error', async ({ propName, errPropName }) => {
		// Arrange
		// this test fails before it calls the event bus, so no need to mock add

		const useCase = new AcceptBackupRequestUseCase(eventBus);

		const dto = { ...baseDto };
		(dto as Record<string, unknown>)[propName] = undefined;

		// Act
		const result = await useCase.execute(dto);

		// Assert
		expect(result.isErr()).toBe(true);
		expect(eventBusPublishSpy).not.toHaveBeenCalled();
		if (result.isErr()) {
			// type guard
			expect(result.error.name).toBe('PropsError');
			expect(result.error.message).toContain('null or undefined');
			expect((result.error.errorData as any).argName).toBe(errPropName);
		}
	});

	test('when executed with an invalid dataDate, it returns the expected error', async () => {
		// Arrange
		// this test fails before it calls the event bus, so no need to mock add

		const useCase = new AcceptBackupRequestUseCase(eventBus);
		const dto = { ...baseDto, dataDate: 'invalid date' };

		// Act
		const result = await useCase.execute(dto);

		// Assert
		expect(result.isErr()).toBe(true);
		expect(eventBusPublishSpy).not.toHaveBeenCalled();
		if (result.isErr()) {
			// type guard
			expect(result.error.message).toContain('not a valid date');
			expect((result.error.errorData as any).argName).toContain('dataDate');
		}
	});

	test('when executed with good data and publish fails, it returns an EventBusError', async () => {
		// Arrange
		mockBullMq.Queue.prototype.add = jest.fn().mockRejectedValueOnce(new EventBusError('simulated event bus error'));

		const useCase = new AcceptBackupRequestUseCase(eventBus);
		const dto = { ...baseDto };

		// Act
		const result = await useCase.execute(dto);

		// Assert
		expect(result.isErr()).toBe(true);
		expect(eventBusPublishSpy).toHaveBeenCalledTimes(1);
		if (result.isErr()) {
			expect(result.error.name).toBe('EventBusError');
		}
	});

	test('when executed with good data, it publishes and returns the backupRequest', async () => {
		// Arrange
		mockBullMq.Queue.prototype.add = jest.fn().mockResolvedValueOnce({} as BackupRequest);

		const useCase = new AcceptBackupRequestUseCase(eventBus);
		const dto = { ...baseDto };

		// Act
		const result = await useCase.execute(dto);

		// Assert
		expect(result.isOk()).toBe(true);
		expect(eventBusPublishSpy).toHaveBeenCalledTimes(1);
		if (result.isOk()) {
			// type guard so TS knows value is valid
			expect(result.value.backupJobId.value).toMatch(baseDto.backupJobId);
			expect(result.value.backupRequestId).toBeTruthy();
		}
	});
});
