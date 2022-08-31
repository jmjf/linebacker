import { CreateBackupRequestUseCase } from './CreateBackupRequestUseCase';
import { CreateBackupRequestDTO } from './CreateBackupRequestDTO';
import { RequestTransportTypeValues } from '../../domain/RequestTransportType';

import {
	MockTypeormContext,
	TypeormContext,
	createMockTypeormContext,
} from '../../../common/infrastructure/typeormContext';
import { TypeormBackupRequestRepo } from '../../adapter/impl/TypeormBackupRequestRepo';
import { TypeormBackupRequest } from '../../../typeorm/entity/TypeormBackupRequest.entity';
import { Dictionary } from '../../../utils/utils';

describe('CreateBackupRequestUseCase - typeorm', () => {
	let mockTypeormCtx: MockTypeormContext;
	let typeormCtx: TypeormContext;

	beforeEach(() => {
		mockTypeormCtx = createMockTypeormContext();
		typeormCtx = mockTypeormCtx as unknown as TypeormContext;
	});

	const baseDto = {
		apiVersion: '2022-01-01',
		backupJobId: 'b753d695-c9e1-4fa1-99f0-9fc025fca24c',
		dataDate: '2022-01-31',
		backupDataLocation: '/path/to/data',
		transportType: RequestTransportTypeValues.HTTP,
		getOnStartFlag: true,
	} as CreateBackupRequestDTO;

	test('when executed with an invalid transport type, it returns the expected error', async () => {
		// Arrange
		// this test fails before it calls the repo, so no need to mock save
		const repo = new TypeormBackupRequestRepo(typeormCtx);
		const saveSpy = jest.spyOn(repo, 'save');

		const useCase = new CreateBackupRequestUseCase(repo);
		const dto = { ...baseDto, transportType: 'BadTransport' };

		// Act
		const result = await useCase.execute(dto);

		// Assert
		expect(result.isErr()).toBe(true);
		expect(saveSpy).toHaveBeenCalledTimes(0);
		if (result.isErr()) {
			// type guard
			expect(result.error.message).toContain('is not one of');
			expect(result.error.message).toContain('transportType');
		}
	});

	test.each([
		{ propName: 'backupJobId', errPropName: 'backupJobId' },
		{ propName: 'dataDate', errPropName: 'dataDate' },
		{ propName: 'backupDataLocation', errPropName: 'preparedDataPathName' },
		{ propName: 'transportType', errPropName: 'transportType' },
		{ propName: 'getOnStartFlag', errPropName: 'getOnStartFlag' },
	])('when executed with $propName undefined, it returns the expected error', async ({ propName, errPropName }) => {
		// Arrange
		// this test fails before it calls the repo, so no need to mock save
		const repo = new TypeormBackupRequestRepo(typeormCtx);
		const saveSpy = jest.spyOn(repo, 'save');

		const useCase = new CreateBackupRequestUseCase(repo);

		const dto = { ...baseDto };
		(dto as Dictionary)[propName] = undefined;

		// Act
		const result = await useCase.execute(dto);

		// Assert
		expect(result.isErr()).toBe(true);
		expect(saveSpy).toHaveBeenCalledTimes(0);
		if (result.isErr()) {
			// type guard
			expect(result.error.name).toBe('PropsError');
			expect(result.error.message).toContain(errPropName);
			expect(result.error.message).toContain('null or undefined');
		}
	});

	test('when executed with an invalid dataDate, it returns the expected error', async () => {
		// Arrange
		// this test fails before it calls the repo, so no need to mock save
		const repo = new TypeormBackupRequestRepo(typeormCtx);
		const saveSpy = jest.spyOn(repo, 'save');

		const useCase = new CreateBackupRequestUseCase(repo);
		const dto = { ...baseDto, dataDate: 'invalid date' };

		// Act
		const result = await useCase.execute(dto);

		// Assert
		expect(result.isErr()).toBe(true);
		expect(saveSpy).toHaveBeenCalledTimes(0);
		if (result.isErr()) {
			// type guard
			expect(result.error.message).toContain('not a valid date');
			expect(result.error.message).toContain('dataDate');
		}
	});

	test('when executed with good data, it returns a saved backupRequest', async () => {
		// Arrange
		mockTypeormCtx.manager.save.mockResolvedValueOnce({} as TypeormBackupRequest);

		const repo = new TypeormBackupRequestRepo(typeormCtx);
		const saveSpy = jest.spyOn(repo, 'save');

		const useCase = new CreateBackupRequestUseCase(repo);
		const dto = { ...baseDto };

		// Act
		const result = await useCase.execute(dto);

		// Assert
		expect(result.isOk()).toBe(true);
		expect(saveSpy).toHaveBeenCalledTimes(1);
		if (result.isOk()) {
			// type guard so TS knows value is valid
			expect(result.value.backupJobId.value).toMatch(baseDto.backupJobId);
			expect(result.value.backupRequestId).toBeTruthy();
		}
	});
});
