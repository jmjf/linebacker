import {
	mockBackupJobProps,
	MockBackupJobServiceAdapter,
} from '../../backup-job/adapter/impl/MockBackupJobServiceAdapter';
import { PrismaContext } from '../../infrastructure/prisma/prismaContext';
import { ExpressCreateBackupRequestController } from '../adapter/impl/ExpressCreateBackupRequestController';

import { FastifyCreateBackupRequestController } from '../adapter/impl/FastifyCreateBackupRequestController';
import { AzureBackupInterfaceStoreAdapter } from '../adapter/impl/AzureBackupInterfaceStoreAdapter';
import { PrismaBackupRequestRepo } from '../adapter/impl/PrismaBackupRequestRepo';
import { BackupRequestCreatedSubscriber } from '../use-cases/check-request-allowed/BackupRequestCreatedSubscriber';
import { CheckRequestAllowedUseCase } from '../use-cases/check-request-allowed/CheckRequestAllowedUseCase';

import { CreateBackupRequestUseCase } from '../use-cases/create-backup-request/CreateBackupRequestUseCase';
import { BackupRequestAllowedSubscriber } from '../use-cases/send-request-to-interface/BackupRequestAllowedSubscriber';
import { SendRequestToInterfaceUseCase } from '../use-cases/send-request-to-interface/SendRequestToInterfaceUseCase';
import { ICircuitBreakers } from '../../infrastructure/buildCircuitBreakers.typeorm';

export const initBackupRequestModule = (
	prismaCtx: PrismaContext,
	circuitBreakers: ICircuitBreakers,
	controllerType: 'Fastify' | 'Express'
) => {
	const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx, circuitBreakers.dbCircuitBreaker);

	const createBackupRequestUseCase = new CreateBackupRequestUseCase(backupRequestRepo);

	// subscribe BackupRequestCreatedSubscriber
	const backupJobServiceAdapter = new MockBackupJobServiceAdapter({ getByIdResult: { ...mockBackupJobProps } });
	const checkRequestAllowedUseCase = new CheckRequestAllowedUseCase({
		backupRequestRepo,
		backupJobServiceAdapter,
	});
	new BackupRequestCreatedSubscriber(checkRequestAllowedUseCase);

	// subscribe BackupRequestAllowedSubscriber
	const interfaceStoreAdapter = new AzureBackupInterfaceStoreAdapter(
		'allowed-backup-requests',
		circuitBreakers.azureQueueCircuitBreaker
	);
	const sendRequestToInterfaceUseCase = new SendRequestToInterfaceUseCase({
		backupRequestRepo,
		interfaceStoreAdapter,
	});
	new BackupRequestAllowedSubscriber(sendRequestToInterfaceUseCase);

	const createBackupRequestController =
		controllerType === 'Fastify'
			? new FastifyCreateBackupRequestController(createBackupRequestUseCase)
			: new ExpressCreateBackupRequestController(createBackupRequestUseCase);

	return {
		backupRequestRepo,
		createBackupRequestUseCase,
		checkRequestAllowedUseCase,
		sendRequestToInterfaceUseCase,
		createBackupRequestController,
	};
};
