import { BaseError } from '../../../common/core/BaseError';

import { DomainEventBus, IDomainEventSubscriber } from '../../../common/domain/DomainEventBus';

import { ConnectFailureErrorData } from '../../../infrastructure/resilience/CircuitBreakerWithRetry';
import { logger } from '../../../infrastructure/logging/pinoLogger';

import { Dictionary } from '../../../common/utils/utils';

import { BackupRequestCreated } from '../../domain/BackupRequestCreated';
import { CheckRequestAllowedUseCase } from './CheckRequestAllowedUseCase';

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);
export class BackupRequestCreatedSubscriber implements IDomainEventSubscriber<BackupRequestCreated> {
	private useCase: CheckRequestAllowedUseCase;
	private failedServices: Dictionary = {};

	constructor(useCase: CheckRequestAllowedUseCase) {
		this.setupSubscriptions();
		this.useCase = useCase;
	}

	setupSubscriptions(): void {
		DomainEventBus.subscribe(BackupRequestCreated.name, this.onBackupRequestCreated.bind(this));
	}

	async onBackupRequestCreated(event: BackupRequestCreated): Promise<void> {
		const backupRequestId = event.getId();
		const eventName = event.constructor.name;
		const logContext = {
			moduleName,
			functionName: 'onBackupRequestCreated',
			backupRequestId: backupRequestId.value,
			eventName: eventName,
		};

		if (Object.keys(this.failedServices).length > 0) {
			// have connection checks
			for (const serviceName in this.failedServices) {
				if (!this.failedServices[serviceName].isConnected()) {
					event.retryCount++;
					this.failedServices[serviceName].addRetryEvent(event);
					return; // something is down so no need to check further
				}

				// if it doesn't fail, don't need to check again
				delete this.failedServices[serviceName];
			}
		}

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

				const errorData = result.error.errorData as ConnectFailureErrorData;
				if (errorData.isConnectFailure) {
					if (errorData.serviceName && errorData.isConnected && !this.failedServices[errorData.serviceName]) {
						this.failedServices[errorData.serviceName] = { isConnected: undefined, addRetryEvent: undefined };
						this.failedServices[errorData.serviceName].isConnected = errorData.isConnected;
						this.failedServices[errorData.serviceName].addRetryEvent = errorData.addRetryEvent;
					}
					if (errorData.addRetryEvent) {
						event.retryCount++;
						errorData.addRetryEvent(event);
					}
				}
			}
		} catch (e) {
			const { message, ...error } = e as BaseError;
			logger.error({ ...logContext, error }, message);
		}
	}
}
