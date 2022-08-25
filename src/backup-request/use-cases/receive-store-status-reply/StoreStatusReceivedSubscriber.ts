import { DomainEventBus, IDomainEventSubscriber } from '../../../common/domain/DomainEventBus';
import { logger } from '../../../common/infrastructure/pinoLogger';
import { IBackupInterfaceStoreAdapter } from '../../adapter/IBackupInterfaceStoreAdapter';
import { StoreStatusReceived } from '../../domain/StoreStatusReceived';
import { ReceiveStoreStatusReplyUseCase } from './ReceiveStoreStatusReplyUseCase';
import { StoreStatusReplyDTO } from './StoreStatusReplyDTO';

export class StoreStatusReceivedSubscriber implements IDomainEventSubscriber<StoreStatusReceived> {
	private useCase: ReceiveStoreStatusReplyUseCase;
	private interfaceAdapter: IBackupInterfaceStoreAdapter;

	constructor(useCase: ReceiveStoreStatusReplyUseCase, interfaceAdapter: IBackupInterfaceStoreAdapter) {
		this.setupSubscriptions();
		this.useCase = useCase;
		this.interfaceAdapter = interfaceAdapter;
	}

	setupSubscriptions(): void {
		DomainEventBus.subscribe(StoreStatusReceived.name, this.onStoreStatusReceived.bind(this));
	}

	async onStoreStatusReceived(event: StoreStatusReceived): Promise<void> {
		// console.log('onStoreStatusReceived', event.messageItem);
		const messageItem = event.messageItem;
		const reply = event.messageItem.messageObject;
		const eventName = event.constructor.name;
		const logContext = {
			context: 'StoreStatusReceivedSubscriber',
			backupRequestId: reply.backupRequestId,
			eventName: eventName,
		};

		const dto: StoreStatusReplyDTO = {
			backupRequestId: reply.backupRequestId,
			storagePathName: reply.storagePathName,
			resultTypeCode: reply.resultTypeCode,
			backupByteCount: reply.backupByteCount,
			copyStartTimestamp: reply.copyStartTimestamp,
			copyEndTimestamp: reply.copyEndTimestamp,
			verifyStartTimestamp: reply.verifyStartTimestamp,
			verifyEndTimestamp: reply.verifyEndTimestamp,
			verifiedHash: reply.verifiedHash,
			messageText: reply.messageText,
		};

		try {
			logger.debug({ ...logContext, msg: 'execute use case' });

			const result = await this.useCase.execute(dto);

			logger.info({
				...logContext,
				resultType: result.isOk() ? 'ok' : 'error',
				valueOrError: result.isOk()
					? {
							backupRequestId: result.value.idValue,
							...result.value.props,
							backupJobId: result.value.backupJobId.value,
					  }
					: result.error,
				msg: 'end use case',
			});

			if (result.isOk() || messageItem.dequeueCount >= 5) {
				const deleteResult = await this.interfaceAdapter.delete(messageItem.messageId, messageItem.popReceipt);
				logger.info({
					...logContext,
					backupRequestId: messageItem.messageObject.backupRequestId,
					messageId: messageItem.messageId,
					popReceipt: messageItem.popReceipt,
					dequeueCount: messageItem.dequeueCount,
					msg: `'${deleteResult.isOk() ? 'deleted' : 'failed to delete'} queue message'`,
				});
			}
		} catch (e) {
			logger.error({ ...logContext, error: e, msg: 'caught error' });
		}
	}
}
