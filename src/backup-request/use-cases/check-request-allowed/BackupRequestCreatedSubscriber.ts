import { DomainEventBus, IDomainEventSubscriber } from '../../../common/domain/DomainEventBus';
import { logger } from '../../../common/infrastructure/pinoLogger';
import { BackupRequestCreated } from '../../domain/BackupRequestCreated';
import { CheckRequestAllowedUseCase } from './CheckRequestAllowedUseCase';

export class BackupRequestCreatedSubscriber implements IDomainEventSubscriber<BackupRequestCreated> {
	private CheckRequestAllowedUseCase: CheckRequestAllowedUseCase;

	constructor(CheckRequestAllowedUseCase: CheckRequestAllowedUseCase) {
		this.setupSubscriptions();
		this.CheckRequestAllowedUseCase = CheckRequestAllowedUseCase;
	}

	setupSubscriptions(): void {
		DomainEventBus.subscribe(BackupRequestCreated.name, this.onBackupRequestCreated.bind(this));
	}

	async onBackupRequestCreated(event: BackupRequestCreated): Promise<void> {
		const backupRequestId = event.getAggregateId();
		const eventName = event.constructor.name;
		const logContext = {
			context: 'check-request-allowed subscriber',
			backupRequestId: backupRequestId.value,
			eventName: eventName,
		};

		try {
			logger.debug({ ...logContext, msg: 'execute use case' });
			const res = await this.CheckRequestAllowedUseCase.execute({
				backupRequestId: backupRequestId.value,
			});
			logger.info({
				...logContext,
				resultType: res.isOk() ? 'ok' : 'error',
				valueOrError: res.isOk()
					? {
							backupRequestId: res.value.idValue,
							...res.value.props,
							backupJobId: res.value.backupJobId.value,
					  }
					: res.error,
				msg: 'end use case',
			});
		} catch (err) {
			logger.error({ ...logContext, error: err, msg: 'caught error' });
		}
	}
}
