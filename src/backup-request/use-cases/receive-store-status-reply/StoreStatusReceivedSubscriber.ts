import { BaseError } from '../../../common/core/BaseError';
import { eventBus } from '../../../common/infrastructure/event-bus/eventBus';
import { IEventBusSubscriber } from '../../../common/infrastructure/event-bus/IEventBus';
import { logger } from '../../../infrastructure/logging/pinoLogger';
import { IBackupInterfaceStoreAdapter } from '../../adapter/IBackupInterfaceStoreAdapter';
import { StoreStatusReceived } from '../../domain/StoreStatusReceived.event';
import { ReceiveStoreStatusReplyUseCase } from './ReceiveStoreStatusReplyUseCase';
import { StoreStatusReplyDTO } from './StoreStatusReplyDTO';

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);
export class StoreStatusReceivedSubscriber implements IEventBusSubscriber<StoreStatusReceived> {
	private useCase: ReceiveStoreStatusReplyUseCase;
	private interfaceAdapter: IBackupInterfaceStoreAdapter;

	constructor(useCase: ReceiveStoreStatusReplyUseCase, interfaceAdapter: IBackupInterfaceStoreAdapter) {
		this.setupSubscriptions();
		this.useCase = useCase;
		this.interfaceAdapter = interfaceAdapter;
	}

	setupSubscriptions(): void {
		eventBus.subscribe(StoreStatusReceived.name, this.onStoreStatusReceived.bind(this));
	}

	async onStoreStatusReceived(event: StoreStatusReceived): Promise<void> {
		// console.log('onStoreStatusReceived', event.messageItem);
		const messageItem = event.eventData.event;
		const storeStatusMessage = messageItem.messageObject;
		const eventName = event.constructor.name;
		const logContext = {
			moduleName,
			functionName: 'onStoreStatusReceived',
			backupRequestId: storeStatusMessage.backupRequestId,
			eventName: eventName,
		};

		const dto: StoreStatusReplyDTO = {
			backupRequestId: storeStatusMessage.backupRequestId,
			storagePathName: storeStatusMessage.storagePathName,
			resultTypeCode: storeStatusMessage.resultTypeCode,
			backupByteCount: storeStatusMessage.backupByteCount,
			copyStartTimestamp: storeStatusMessage.copyStartTimestamp,
			copyEndTimestamp: storeStatusMessage.copyEndTimestamp,
			verifyStartTimestamp: storeStatusMessage.verifyStartTimestamp,
			verifyEndTimestamp: storeStatusMessage.verifyEndTimestamp,
			verifiedHash: storeStatusMessage.verifiedHash,
			messageText: storeStatusMessage.messageText,
		};

		try {
			logger.debug({ ...logContext }, 'Execute use case');

			const result = await this.useCase.execute(dto);

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

			if (result.isOk() || messageItem.dequeueCount >= 5) {
				const deleteResult = await this.interfaceAdapter.delete(messageItem.messageId, messageItem.popReceipt);
				logger.info(
					{
						...logContext,
						backupRequestId: messageItem.messageObject.backupRequestId,
						messageId: messageItem.messageId,
						popReceipt: messageItem.popReceipt,
						dequeueCount: messageItem.dequeueCount,
					},
					`'${deleteResult.isOk() ? 'Deleted' : 'Failed to delete'} queue message'`
				);
			}
		} catch (e) {
			const { message, ...error } = e as BaseError;
			logger.error({ ...logContext, error }, message);
		}
	}
}
