import { Job, UnrecoverableError } from 'bullmq';
import { ReceiveBackupRequestUseCase } from '../../use-cases/receive-backup-request/ReceiveBackupRequestUseCase';
import { IQueueConsumer } from '../IQueueConsumer';

export class AcceptedBackupRequestConsumer implements IQueueConsumer {
	private useCase: ReceiveBackupRequestUseCase;

	constructor(receiveBackupRequestUseCase: ReceiveBackupRequestUseCase) {
		this.useCase = receiveBackupRequestUseCase;
	}

	async consume(job: Job) {
		const { attemptsMade, data } = job;

		const { connectFailureCount, ...request } = data;

		// const result = await this.useCase.execute(request);
		const result = await this.useCase.execute(request);
		console.log('consume result', result);
		if (result.isErr()) {
			// log error
			// if unrecoverable throw unrecoverable
			// else retry
			throw new Error('default error');
		}

		if (attemptsMade - connectFailureCount > 5) throw new UnrecoverableError('too many attempts');

		return result.value;
	}
}
