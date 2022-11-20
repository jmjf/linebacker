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
		const { attemptsMade, data } = job;

		const { connectFailureCount, event } = data;

		const result = await this.useCase.execute(event);
		if (result.isErr()) {
			logger.error(
				{ error: result.error, jobData: job.data, moduleName, functionName },
				'event bus consumer failure'
			);

			if (result.error.errorData && (result.error.errorData as any).isConnectFailure) {
				job.update({ ...job.data, connectFailureCount: connectFailureCount + 1 });
				throw new AdapterErrors.EventBusError('retry connect error', result.error);
			}

			if (attemptsMade - connectFailureCount > this.maxTrueFailures) {
				throw new UnrecoverableError('do not retry');
			}

			throw new AdapterErrors.EventBusError('retry other error', result.error);
		}

		return result.value;
	}
}
