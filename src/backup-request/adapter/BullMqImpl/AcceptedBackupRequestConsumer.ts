import { Job, UnrecoverableError } from 'bullmq';

import { logger } from '../../../infrastructure/logging/pinoLogger';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';

import { ReceiveBackupRequestUseCase } from '../../use-cases/receive-backup-request/ReceiveBackupRequestUseCase';
import { IEventBusConsumer } from '../IEventBusConsumer';
import path from 'node:path';

const moduleName = path.basename(module.filename);
export class AcceptedBackupRequestConsumer implements IEventBusConsumer {
	private useCase: ReceiveBackupRequestUseCase;
	private maxTrueFailures: number;

	constructor(receiveBackupRequestUseCase: ReceiveBackupRequestUseCase, maxTrueFailures: number) {
		this.useCase = receiveBackupRequestUseCase;
		this.maxTrueFailures = maxTrueFailures;
	}

	async consume(job: Job) {
		const functionName = 'consume';
		const logContext = { jobName: job.name, jobId: job.id, moduleName, functionName };

		logger.trace({ useCaseName: this.useCase.constructor.name, jobData: job.data, ...logContext }, 'consuming job');
		const { attemptsMade, data } = job;

		const event = data.event;
		const connectFailureCount = data.connectFailureCount || 0;

		logger.trace({ jobName: job.name, jobId: job.id, moduleName, functionName }, 'Execute use case');

		try {
			const result = await this.useCase.execute(event);
			logger.trace(
				{ isOk: result.isOk(), result: result.isOk() ? result.value : result.error, ...logContext },
				'Use case result'
			);

			if (result.isErr()) {
				logger.error({ error: result.error, jobData: job.data, ...logContext }, 'Use case error');

				if (result.error.errorData && (result.error.errorData as any).isConnectFailure) {
					job.update({ ...job.data, connectFailureCount: connectFailureCount + 1 });

					logger.trace({ ...logContext }, 'Connect error');
					throw new AdapterErrors.EventBusError('retry connect error', result.error);
				}

				if (attemptsMade - connectFailureCount > this.maxTrueFailures) {
					logger.trace({ ...logContext }, 'Unrecoverable error');
					throw new UnrecoverableError('do not retry');
				}

				logger.trace({ ...logContext }, 'Other error');
				throw new AdapterErrors.EventBusError('retry other error', result.error);
			}

			logger.debug({ result: result.value, ...logContext }, 'Use case ok');
			return result.value;
		} catch (e) {
			logger.error({ error: e, ...logContext }, 'Consumer caught error');
			throw e;
		}
	}
}
