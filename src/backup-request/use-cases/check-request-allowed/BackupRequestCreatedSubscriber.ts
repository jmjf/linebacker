import { BaseError } from '../../../common/core/BaseError';
import { DomainEventBus, IDomainEventSubscriber } from '../../../common/domain/DomainEventBus';
import { logger } from '../../../common/infrastructure/pinoLogger';
import { BackupRequestCreated } from '../../domain/BackupRequestCreated';
import { CheckRequestAllowedUseCase } from './CheckRequestAllowedUseCase';

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);
export class BackupRequestCreatedSubscriber implements IDomainEventSubscriber<BackupRequestCreated> {
	private useCase: CheckRequestAllowedUseCase;

	constructor(useCase: CheckRequestAllowedUseCase) {
		this.setupSubscriptions();
		this.useCase = useCase;
	}

	setupSubscriptions(): void {
		DomainEventBus.subscribe(BackupRequestCreated.name, this.onBackupRequestCreated.bind(this));
	}

	async onBackupRequestCreated(event: BackupRequestCreated): Promise<void> {
		const backupRequestId = event.getAggregateId();
		const eventName = event.constructor.name;
		const logContext = {
			moduleName,
			functionName: 'onBackupRequestCreated',
			backupRequestId: backupRequestId.value,
			eventName: eventName,
		};

		try {
			logger.debug({ ...logContext }, 'Execute use case');
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
