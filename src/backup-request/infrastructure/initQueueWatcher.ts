import { Request, Application, Response, Router } from 'express';

import {
	mockBackupJobProps,
	MockBackupJobServiceAdapter,
} from '../../backup-job/adapter/impl/MockBackupJobServiceAdapter';
import { TypeormContext } from '../../infrastructure/typeorm/typeormContext';
import { ICircuitBreakers } from '../../infrastructure/typeorm/buildCircuitBreakers.typeorm';
import { logger } from '../../infrastructure/logging/pinoLogger';
import path from 'node:path';
import { TypeormBackupRequestRepo } from '../adapter/impl/TypeormBackupRequestRepo';
import { TypeormBackupRepo } from '../../backup/adapter/impl/TypeormBackupRepo';
import { ReceiveStoreStatusReplyUseCase } from '../use-cases/receive-store-status-reply/ReceiveStoreStatusReplyUseCase';
import { StoreStatusReceivedSubscriber } from '../use-cases/receive-store-status-reply/StoreStatusReceivedSubscriber';
import { AzureBackupInterfaceStoreAdapter } from '../adapter/impl/AzureBackupInterfaceStoreAdapter';
import { AzureStoreStatusMessageHandler } from '../adapter/impl/AzureStoreStatusMessageHandler';
import { AzureQueueWatcher } from '../../infrastructure/azure-queue/AzureQueueWatcher';
import { appState } from '../../infrastructure/app-state/appState';

const moduleName = path.basename(module.filename);

export function initQueueWatcher(
	typeormCtx: TypeormContext,
	circuitBreakers: ICircuitBreakers,
	abortSignal: AbortSignal
) {
	const functionName = 'initQueueWatcher';

	const queueName = 'store-statuses';

	const queueAdapter = new AzureBackupInterfaceStoreAdapter(queueName, circuitBreakers.azureQueueCircuitBreaker);

	if (appState.eventBus_type.toLowerCase() !== 'bullmq') {
		const backupRequestRepo = new TypeormBackupRequestRepo(typeormCtx, circuitBreakers.dbCircuitBreaker);
		const backupJobServiceAdapter = new MockBackupJobServiceAdapter({ getByIdResult: { ...mockBackupJobProps } });
		const backupRepo = new TypeormBackupRepo(typeormCtx, circuitBreakers.dbCircuitBreaker);

		const receiveStatusUseCase = new ReceiveStoreStatusReplyUseCase({
			backupRequestRepo,
			backupJobServiceAdapter,
			backupRepo,
		});

		new StoreStatusReceivedSubscriber(receiveStatusUseCase, queueAdapter);
	}
	const messageHandler = new AzureStoreStatusMessageHandler(queueAdapter);

	const queueWatcher = new AzureQueueWatcher({
		messageHandler,
		queueAdapter,
		minDelayMs: 1000,
		maxDelayMs: 5000,
		delayIncrementMs: 1000,
		abortSignal,
		logger,
		queueName,
	});

	setTimeout(() => {
		queueWatcher.startWatcher();
	}, appState.brQueueWatcher_startDelayMs);

	return queueWatcher;
}
