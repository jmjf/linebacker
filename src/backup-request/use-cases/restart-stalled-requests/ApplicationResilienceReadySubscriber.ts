import { BaseError } from '../../../common/core/BaseError';

import { DomainEventBus, IDomainEvent, IDomainEventSubscriber } from '../../../common/domain/DomainEventBus';

import { logger } from '../../../infrastructure/logging/pinoLogger';

import { Dictionary } from '../../../common/utils/utils';

import { RestartStalledRequestsUseCase } from './RestartStalledRequestsUseCase';
import { ApplicationResilienceReady } from '../../../infrastructure/resilience/ApplicationResilienceReady';

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);
export class ApplicationResilienceReadySubscriber implements IDomainEventSubscriber<ApplicationResilienceReady> {
	private useCase: RestartStalledRequestsUseCase;
	private failedServices: Dictionary = {};

	constructor(useCase: RestartStalledRequestsUseCase) {
		this.setupSubscriptions();
		this.useCase = useCase;
	}

	setupSubscriptions(): void {
		DomainEventBus.subscribe(ApplicationResilienceReady.name, this.onApplicationResilienceReady.bind(this));
	}

	async onApplicationResilienceReady(event: ApplicationResilienceReady): Promise<void> {
		const eventName = event.constructor.name;
		const logContext = {
			applicationModuleName: 'backup-request',
			moduleName,
			functionName: 'onApplicationResilienceReady',
			eventName: eventName,
			beforeTimestamp: event.beforeTimestamp.toISOString(),
		};

		// This subscriber does not support retries on use case errors

		try {
			logger.debug({ ...logContext }, 'Execute use case');
			const result = await this.useCase.execute({ beforeTimestamp: event.beforeTimestamp });

			if (result.allowedResult.isOk() && result.receivedResult.isOk()) {
				logger.info(
					{
						...logContext,
						allowedResultType: 'ok',
						receivedResultType: 'ok',
						value: {
							allowedResult: this.getEventIds(result.allowedResult.value),
							receivedResult: this.getEventIds(result.receivedResult.value),
						},
					},
					'Use case ok'
				);
			} else {
				logger.error(
					{
						...logContext,
						allowedResultType: result.allowedResult.isErr() ? 'error' : 'ok',
						receivedResultType: result.receivedResult.isErr() ? 'error' : 'ok',
						error: {
							allowedResult: result.allowedResult.isErr()
								? result.allowedResult.error
								: this.getEventIds(result.allowedResult.value),
							receivedResult: result.receivedResult.isErr()
								? result.receivedResult.error
								: this.getEventIds(result.receivedResult.value),
						},
					},
					'Use case error'
				);
				// this subscriber does not support retries on use case errors
			}
		} catch (e) {
			const { message, ...error } = e as BaseError;
			logger.error({ ...logContext, error }, message);
		}
	}

	private getEventIds(evArray: IDomainEvent[]): string[] {
		return evArray.map((ev) => ev.getId().value);
	}
}
