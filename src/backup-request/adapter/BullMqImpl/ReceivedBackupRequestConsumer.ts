import { Job, UnrecoverableError } from 'bullmq';

import { logger } from '../../../infrastructure/logging/pinoLogger';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';

// import { ReceiveBackupRequestUseCase } from '../../use-cases/receive-backup-request/ReceiveBackupRequestUseCase';
import { IEventBusConsumer } from '../IEventBusConsumer';
import path from 'node:path';

// begin test use case
import { UseCase } from '../../../common/application/UseCase';
import { ok, Result } from '../../../common/core/Result';
import { BaseError } from '../../../common/core/BaseError';

interface TestDTO {
	backupRequestId: string;
}

class TestUseCase implements UseCase<TestDTO, Promise<Result<string, BaseError>>> {
	constructor() {
		//
	}

	async execute(dto: TestDTO): Promise<Result<string, BaseError>> {
		logger.info(dto, 'Received -- test use case');
		return ok('test');
	}
}

// end test use case

const moduleName = path.basename(module.filename);
export class ReceivedBackupRequestConsumer implements IEventBusConsumer {
	private useCase: TestUseCase;
	private maxTrueFailures: number;

	constructor(
		//receiveBackupRequestUseCase: ReceiveBackupRequestUseCase,
		maxTrueFailures: number
	) {
		// this.useCase = receiveBackupRequestUseCase;
		this.useCase = new TestUseCase();
		this.maxTrueFailures = maxTrueFailures;
	}

	async consume(job: Job) {
		const functionName = 'consume';
		const logContext = { jobName: job.name, jobId: job.id, moduleName, functionName };

		logger.trace({ useCaseName: this.useCase.constructor.name, jobData: job.data, ...logContext }, 'consuming job');

		const attemptsMade = job.attemptsMade;
		const { domainEvent, connectFailureCount, retryCount } = job.data;

		logger.trace({ jobName: job.name, jobId: job.id, moduleName, functionName }, 'Execute use case');

		try {
			const result = await this.useCase.execute(domainEvent);
			logger.trace(
				{ isOk: result.isOk(), result: result.isOk() ? result.value : result.error, ...logContext },
				'Use case result'
			);

			if (result.isErr()) {
				logger.error({ error: result.error, jobData: job.data, ...logContext }, 'Use case error');

				if (result.error.errorData && (result.error.errorData as any).isConnectFailure) {
					job.update({ ...job.data, connectFailureCount: connectFailureCount + 1, retryCount: retryCount + 1 });
					throw new AdapterErrors.EventBusError('Connect error - retry', result.error);
				}

				if (attemptsMade - connectFailureCount <= this.maxTrueFailures) {
					job.update({ ...job.data, retryCount: retryCount + 1 });
					throw new AdapterErrors.EventBusError('Other error - retry', result.error);
				}

				throw new UnrecoverableError('Too many failures - fail');
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
