import { MockBackupJobServiceAdapter } from '../../backup-job/adapter/impl/MockBackupJobServiceAdapter';
import { PrismaContext } from '../../common/infrastructure/database/prismaContext';
import { ExpressCreateBackupRequestController } from '../adapter/impl/ExpressCreateBackupRequestController';

import { FastifyCreateBackupRequestController } from '../adapter/impl/FastifyCreateBackupRequestController';
import { PrismaBackupRequestRepo } from '../adapter/impl/PrismaBackupRequestRepo';
import { BackupRequestCreatedSubscriber } from '../use-cases/check-request-allowed/BackupRequestCreatedSubscriber';
import { CheckRequestAllowedUseCase } from '../use-cases/check-request-allowed/CheckRequestAllowedUseCase';

import { CreateBackupRequestUseCase } from '../use-cases/create-backup-request/CreateBackupRequestUseCase';

export const initBackupRequestModule = (
	prismaCtx: PrismaContext,
	controllerType: 'Fastify' | 'Express'
) => {
	const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);

	const createBackupRequestUseCase = new CreateBackupRequestUseCase(
		backupRequestRepo
	);

	const backupJobServiceAdapter = new MockBackupJobServiceAdapter();
	const checkRequestAllowedUseCase = new CheckRequestAllowedUseCase({
		backupRequestRepo,
		backupJobServiceAdapter,
	});
	// we don't need a reference to the subscriber
	new BackupRequestCreatedSubscriber(checkRequestAllowedUseCase);

	const createBackupRequestController =
		controllerType === 'Fastify'
			? new FastifyCreateBackupRequestController(createBackupRequestUseCase)
			: new ExpressCreateBackupRequestController(createBackupRequestUseCase);

	return {
		backupRequestRepo,
		createBackupRequestUseCase,
		checkRequestAllowedUseCase,
		createBackupRequestController,
	};
};
