import { BaseError } from '../../../common/core/BaseError';

import { eventBus } from '../../../common/infrastructure/event-bus/eventBus';
import { IEventBusSubscriber } from '../../../common/infrastructure/event-bus/IEventBus';

import { ConnectFailureErrorData } from '../../../infrastructure/resilience/CircuitBreakerWithRetry';
import { logger } from '../../../infrastructure/logging/pinoLogger';

import { Dictionary } from '../../../common/utils/utils';

import { BackupRequestAllowed } from '../../domain/BackupRequestAllowed.event';
import { SendRequestToInterfaceUseCase } from './SendRequestToInterfaceUseCase';

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);

export class BackupRequestAllowedSubscriber implements IEventBusSubscriber<BackupRequestAllowed> {
	private useCase: SendRequestToInterfaceUseCase;
	private failedServices: Dictionary = {};

	constructor(useCase: SendRequestToInterfaceUseCase) {
		this.setupSubscriptions();
		this.useCase = useCase;
	}

	setupSubscriptions(): void {
		eventBus.subscribe(BackupRequestAllowed.name, this.onBackupRequestAllowed.bind(this));
	}

	async onBackupRequestAllowed(event: BackupRequestAllowed): Promise<void> {
		const eventKey = event.eventKey;
		const logContext = {
			moduleName,
			functionName: 'onBackupRequestAllowed',
			eventKey,
			eventType: event.constructor.name,
		};

		if (Object.keys(this.failedServices).length > 0) {
			// have connection checks
			for (const serviceName in this.failedServices) {
				if (!this.failedServices[serviceName].isConnected()) {
					event.eventData.retryCount++;
					this.failedServices[serviceName].addRetryEvent(event);
					return; // something is down so no need to check further
				}

				// if it doesn't fail, don't need to check again
				delete this.failedServices[serviceName];
			}
		}

		try {
			logger.debug({ ...logContext, msg: 'execute use case' });
			const result = await this.useCase.execute({
				backupRequestId: eventKey,
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
					// console.log(
					// 	'BRAS connect failure',
					// 	errorData.serviceName,
					// 	errorData.isConnected,
					// 	errorData.addRetryEvent
					// );
					if (errorData.serviceName && errorData.isConnected && !this.failedServices[errorData.serviceName]) {
						this.failedServices[errorData.serviceName] = { isConnected: undefined, addRetryEvent: undefined };
						this.failedServices[errorData.serviceName].isConnected = errorData.isConnected;
						this.failedServices[errorData.serviceName].addRetryEvent = errorData.addRetryEvent;
					}
					if (errorData.addRetryEvent) {
						event.eventData.retryCount++;
						// console.log('BRAS add retry event', event);
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
