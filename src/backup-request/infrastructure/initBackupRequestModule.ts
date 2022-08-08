import { MockBackupJobServiceAdapter } from '../../backup-job/adapter/impl/MockBackupJobServiceAdapter';
import { PrismaContext } from '../../common/infrastructure/database/prismaContext';
import { ExpressCreateBackupRequestController } from '../adapter/impl/ExpressCreateBackupRequestController';

import { FastifyCreateBackupRequestController } from '../adapter/impl/FastifyCreateBackupRequestController';
import { MockBackupRequestBackupInterfaceAdapter } from '../adapter/impl/MockBackupRequestBackupInterfaceAdapter';
import { PrismaBackupRequestRepo } from '../adapter/impl/PrismaBackupRequestRepo';
import { BackupRequestCreatedSubscriber } from '../use-cases/check-request-allowed/BackupRequestCreatedSubscriber';
import { CheckRequestAllowedUseCase } from '../use-cases/check-request-allowed/CheckRequestAllowedUseCase';

import { CreateBackupRequestUseCase } from '../use-cases/create-backup-request/CreateBackupRequestUseCase';
import { BackupRequestAllowedSubscriber } from '../use-cases/send-request-to-interface/BackupRequestAllowedSubscriber';
import { SendRequestToInterfaceUseCase } from '../use-cases/send-request-to-interface/SendRequestToInterfaceUseCase';

export const initBackupRequestModule = (
	prismaCtx: PrismaContext,
	controllerType: 'Fastify' | 'Express'
) => {
	const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);

	const createBackupRequestUseCase = new CreateBackupRequestUseCase(
		backupRequestRepo
	);

	// subscribe BackupRequestCreatedSubscriber
	const backupJobServiceAdapter = new MockBackupJobServiceAdapter();
	const checkRequestAllowedUseCase = new CheckRequestAllowedUseCase({
		backupRequestRepo,
		backupJobServiceAdapter,
	});
	new BackupRequestCreatedSubscriber(checkRequestAllowedUseCase);

	// subscribe BackupRequestAllowedSubscriber
	const backupInterfaceAdapter = new MockBackupRequestBackupInterfaceAdapter();
	const sendRequestToInterfaceUseCase = new SendRequestToInterfaceUseCase({
		backupRequestRepo,
		backupInterfaceAdapter,
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
