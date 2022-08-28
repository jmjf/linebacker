import { CreateBackupRequestUseCase } from './CreateBackupRequestUseCase';
import { CreateBackupRequestDTO } from './CreateBackupRequestDTO';
import { RequestTransportTypeValues } from '../../domain/RequestTransportType';
import { PrismaBackupRequestRepo } from '../../adapter/impl/PrismaBackupRequestRepo';

import {
	MockPrismaContext,
	PrismaContext,
	createMockPrismaContext,
} from '../../../common/infrastructure/database/prismaContext';
import { PrismaBackupRequest } from '@prisma/client';

describe('CreateBackupRequestUseCase - Prisma', () => {
	let mockPrismaCtx: MockPrismaContext;
	let prismaCtx: PrismaContext;

	beforeEach(() => {
		mockPrismaCtx = createMockPrismaContext();
		prismaCtx = mockPrismaCtx as unknown as PrismaContext;
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
		// this test fails before it calls the repo, so no need to mock upsert

		const repo = new PrismaBackupRequestRepo(prismaCtx);
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
		// this test fails before it calls the repo, so no need to mock upsert

		const repo = new PrismaBackupRequestRepo(prismaCtx);
		const saveSpy = jest.spyOn(repo, 'save');

		const useCase = new CreateBackupRequestUseCase(repo);

		const dto = { ...baseDto };
		(dto as { [index: string]: any })[propName] = undefined;

		// Act
		const result = await useCase.execute(dto);

		// Assert
		expect(result.isErr()).toBe(true);
		expect(saveSpy).toHaveBeenCalledTimes(0);
		if (result.isErr()) {
			expect(result.error.name).toBe('PropsError');
			expect(result.error.message).toContain(errPropName);
			expect(result.error.message).toContain('null or undefined');
		}
	});

	test('when executed with an invalid dataDate, it returns the expected error', async () => {
		// Arrange
		// this test fails before it calls the repo, so no need to mock upsert

		const repo = new PrismaBackupRequestRepo(prismaCtx);
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

		// The repo's save() only cares that upsert() succeeds, so the value doesn't matter
		// VS Code sometimes highlights the next line as an error (circular reference) -- its wrong
		mockPrismaCtx.prisma.prismaBackupRequest.upsert.mockResolvedValue({} as unknown as PrismaBackupRequest);

		const repo = new PrismaBackupRequestRepo(prismaCtx);
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
