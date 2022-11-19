import {
	mockBackupJobProps,
	MockBackupJobServiceAdapter,
} from '../../backup-job/adapter/impl/MockBackupJobServiceAdapter';
import { TypeormContext } from '../../infrastructure/typeorm/typeormContext';
import { ExpressCreateBackupRequestController } from '../adapter/impl/ExpressCreateBackupRequestController';

import { FastifyCreateBackupRequestController } from '../adapter/impl/FastifyCreateBackupRequestController';
import { AzureBackupInterfaceStoreAdapter } from '../adapter/impl/AzureBackupInterfaceStoreAdapter';
import { TypeormBackupRequestRepo } from '../adapter/impl/TypeormBackupRequestRepo';
import { BackupRequestCreatedSubscriber } from '../use-cases/check-request-allowed/BackupRequestCreatedSubscriber';
import { CheckRequestAllowedUseCase } from '../use-cases/check-request-allowed/CheckRequestAllowedUseCase';

import { CreateBackupRequestUseCase } from '../use-cases/create-backup-request/CreateBackupRequestUseCase';
import { BackupRequestAllowedSubscriber } from '../use-cases/send-request-to-interface/BackupRequestAllowedSubscriber';
import { SendRequestToInterfaceUseCase } from '../use-cases/send-request-to-interface/SendRequestToInterfaceUseCase';
import { ICircuitBreakers } from '../../infrastructure/prisma/buildCircuitBreakers.prisma';
import { RestartStalledRequestsUseCase } from '../use-cases/restart-stalled-requests/RestartStalledRequestsUseCase';
import { ApplicationResilienceReadySubscriber } from '../use-cases/restart-stalled-requests/ApplicationResilienceReadySubscriber';
import { BmqBackupRequestEventBus } from '../adapter/impl/BmqBackupRequestEventBus';
import { AcceptBackupRequestUseCase } from '../use-cases/accept-backup-request/AcceptBackupRequestUseCase';
import { ExpressAcceptBackupRequestController } from '../adapter/impl/ExpressAcceptBackupRequestController';
import { BullMq } from '../../infrastructure/bullmq/bullMqInfra';

export const initBackupRequestModule = (
	typeormCtx: TypeormContext,
	bullMq: BullMq,
	circuitBreakers: ICircuitBreakers,
	controllerType: 'Fastify' | 'Express',
	abortSignal: AbortSignal
) => {
	const bmqBackupRequestEventBus = new BmqBackupRequestEventBus(bullMq, {
		host: 'localhost',
		port: 6379,
	});
	const acceptBackupRequestUseCase = new AcceptBackupRequestUseCase(bmqBackupRequestEventBus);
	const acceptBackupRequestController = new ExpressAcceptBackupRequestController(acceptBackupRequestUseCase);

	const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreakers.dbCircuitBreaker);

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

	const restartStalledRequestsUseCase = new RestartStalledRequestsUseCase(backupRequestRepo, abortSignal);
	new ApplicationResilienceReadySubscriber(restartStalledRequestsUseCase);

	return {
		backupRequestRepo,
		createBackupRequestUseCase,
		checkRequestAllowedUseCase,
		sendRequestToInterfaceUseCase,
		createBackupRequestController,
		restartStalledRequestsUseCase,
		acceptBackupRequestController,
		acceptBackupRequestUseCase,
	};
};
