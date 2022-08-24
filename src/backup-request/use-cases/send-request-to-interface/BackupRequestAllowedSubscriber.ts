import { DomainEventBus, IDomainEventSubscriber } from '../../../common/domain/DomainEventBus';
import { logger } from '../../../common/infrastructure/pinoLogger';
import { BackupRequestAllowed } from '../../domain/BackupRequestAllowed';
import { SendRequestToInterfaceUseCase } from './SendRequestToInterfaceUseCase';

export class BackupRequestAllowedSubscriber implements IDomainEventSubscriber<BackupRequestAllowed> {
	private sendRequestToInterfaceUseCase: SendRequestToInterfaceUseCase;

	constructor(sendRequestToInterfaceUseCase: SendRequestToInterfaceUseCase) {
		this.setupSubscriptions();
		this.sendRequestToInterfaceUseCase = sendRequestToInterfaceUseCase;
	}

	setupSubscriptions(): void {
		DomainEventBus.subscribe(BackupRequestAllowed.name, this.onBackupRequestAllowed.bind(this));
	}

	async onBackupRequestAllowed(event: BackupRequestAllowed): Promise<void> {
		const backupRequestId = event.getAggregateId();
		const logContext = {
			context: 'send-request-to-interface subscriber',
			backupRequestId: backupRequestId.value,
			eventName: event.constructor.name,
		};

		try {
			logger.debug({ ...logContext, msg: 'execute use case' });
			const res = await this.sendRequestToInterfaceUseCase.execute({
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
