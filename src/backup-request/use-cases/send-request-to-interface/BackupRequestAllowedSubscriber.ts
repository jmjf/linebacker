import { BaseError } from '../../../common/core/BaseError';
import { DomainEventBus, IDomainEventSubscriber } from '../../../common/domain/DomainEventBus';
import { logger } from '../../../common/infrastructure/pinoLogger';
import { BackupRequestAllowed } from '../../domain/BackupRequestAllowed';
import { SendRequestToInterfaceUseCase } from './SendRequestToInterfaceUseCase';

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);

export class BackupRequestAllowedSubscriber implements IDomainEventSubscriber<BackupRequestAllowed> {
	private useCase: SendRequestToInterfaceUseCase;

	constructor(useCase: SendRequestToInterfaceUseCase) {
		this.setupSubscriptions();
		this.useCase = useCase;
	}

	setupSubscriptions(): void {
		DomainEventBus.subscribe(BackupRequestAllowed.name, this.onBackupRequestAllowed.bind(this));
	}

	async onBackupRequestAllowed(event: BackupRequestAllowed): Promise<void> {
		const backupRequestId = event.getAggregateId();
		const logContext = {
			moduleName,
			functionName: 'onBackupRequestAllowed',
			backupRequestId: backupRequestId.value,
			eventName: event.constructor.name,
		};

		try {
			logger.debug({ ...logContext, msg: 'execute use case' });
			const result = await this.useCase.execute({
				backupRequestId: backupRequestId.value,
			});
			if (result.isOk()) {
				logger.info(
					{
						...logContext,
						resultType: 'ok',
						value: {
							backupRequestId: result.value.idValue,
							...result.value.props,
							backupJobId: result.value.backupJobId.value,
						},
					},
					'Use case ok'
				);
			} else {
				logger.error(
					{
						...logContext,
						resultType: 'error',
						error: result.error,
					},
					'Use case error'
				);
			}
		} catch (e) {
			const { message, ...error } = e as BaseError;
			logger.error({ ...logContext, error }, message);
		}
	}
}
