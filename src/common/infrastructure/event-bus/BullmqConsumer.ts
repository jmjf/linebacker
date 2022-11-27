import { Job, UnrecoverableError } from 'bullmq';
import path from 'node:path';

import { logger } from '../../../infrastructure/logging/pinoLogger';
import * as InfrastructureErrors from '../InfrastructureErrors';

import { SendRequestToInterfaceUseCase } from '../../../backup-request/use-cases/send-request-to-interface/SendRequestToInterfaceUseCase';
import { ReceiveBackupRequestUseCase } from '../../../backup-request/use-cases/receive-backup-request/ReceiveBackupRequestUseCase';
import { CheckRequestAllowedUseCase } from '../../../backup-request/use-cases/check-request-allowed-2/CheckRequestAllowedUseCase';
import { ReceiveStoreStatusReplyUseCase } from '../../../backup-request/use-cases/receive-store-status-reply/ReceiveStoreStatusReplyUseCase';

const moduleName = path.basename(module.filename);

type BullmqConsumerUseCase =
	| ReceiveBackupRequestUseCase
	| CheckRequestAllowedUseCase
	| SendRequestToInterfaceUseCase
	| ReceiveStoreStatusReplyUseCase;

export interface IBullmqEventBusConsumer {
	consume(job: unknown): unknown | Error;
}

export class BullmqConsumer implements IBullmqEventBusConsumer {
	private useCase: BullmqConsumerUseCase;
	private maxTrueFailures: number;

	constructor(useCase: BullmqConsumerUseCase, maxTrueFailures: number) {
		this.useCase = useCase;
		this.maxTrueFailures = maxTrueFailures;
	}

	async consume(job: Job) {
		const functionName = 'consume';
		const logContext = { jobName: job.name, jobId: job.id, eventType: '', moduleName, functionName };

		logger.trace({ useCaseName: this.useCase.constructor.name, jobData: job.data, ...logContext }, 'Consuming job');

		const attemptsMade = job.attemptsMade;
		const { event, eventType, connectFailureCount, retryCount } = job.data;
		logContext.eventType = eventType;

		logger.trace({ ...logContext }, 'Execute use case');

		try {
			const result = await this.useCase.execute(event);
			logger.trace(
				{ isOk: result.isOk(), result: result.isOk() ? result.value : result.error, ...logContext },
				'Use case result'
			);

			if (result.isErr()) {
				logger.error({ error: result.error, jobData: job.data, ...logContext }, 'Use case error');

				if (result.error.errorData && (result.error.errorData as any).isConnectFailure) {
					job.update({ ...job.data, connectFailureCount: connectFailureCount + 1, retryCount: retryCount + 1 });
					throw new InfrastructureErrors.EventBusError('Connect error - retry', result.error);
				}

				if (attemptsMade - connectFailureCount <= this.maxTrueFailures) {
					job.update({ ...job.data, retryCount: retryCount + 1 });
					throw new InfrastructureErrors.EventBusError('Other error - retry', result.error);
				}

				throw new UnrecoverableError('Too many attempts - fail');
			}

			logger.debug({ result: result.value, ...logContext }, 'Use case ok');
			return result.value;
		} catch (e) {
			// anything in try that throws ends up here, including the intentional throws
			// log all errors here, including errors thrown in the try block
			const { message } = e as Error;
			logger.error({ error: e, attemptsMade, connectFailureCount, ...logContext }, message);
			throw e;
		}
	}
}
