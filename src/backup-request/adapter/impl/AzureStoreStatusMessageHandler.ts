import { ReceivedMessageItem } from '@azure/storage-queue';

import { Result, ok, err } from '../../../common/core/Result';
import { IStoreStatusMessageHandler } from '../IStoreStatusMessageHandler';

import { StoreStatusMessage, StoreStatusMessageItem, StoreStatusReceived } from '../../domain/StoreStatusReceived';

import * as AdapterErrors from '../../../common/adapter/AdapterErrors';
import { logger } from '../../../common/infrastructure/pinoLogger';
import { DomainEventBus } from '../../../common/domain/DomainEventBus';

export class AzureStoreStatusMessageHandler implements IStoreStatusMessageHandler {
	async processMessage(
		message: ReceivedMessageItem,
		opts?: unknown
	): Promise<Result<boolean, AdapterErrors.StatusJsonError>> {
		let messageObject: StoreStatusMessage;

		try {
			messageObject = JSON.parse(message.messageText);
		} catch (e) {
			logger.error({
				msg: 'Invalid messageText JSON in queue message',
				providerType: 'CloudA',
				messageId: message.messageId,
				dequeueCount: message.dequeueCount,
				messageText: message.messageText,
			});
			if (message.dequeueCount >= 4) {
				// TODO: store it and delete it
				console.log('store message, delete message from queue');
			}
			return err(
				new AdapterErrors.StatusJsonError(`{message: 'Invalid messageText JSON', messageId: ${message.messageId}}`)
			);
		}

		// console.log('message handler for', messageObject.backupRequestId);

		// JSON parsed successfully
		const eventMessage: StoreStatusMessageItem = {
			messageId: message.messageId,
			popReceipt: message.popReceipt,
			dequeueCount: message.dequeueCount,
			messageObject: messageObject,
		};
		//console.log('assmh eventMessage', eventMessage);

		const event = new StoreStatusReceived(eventMessage);

		DomainEventBus.publishToSubscribers(event);

		logger.info({
			msg: 'Published StoreStatusReceived event',
			providerType: 'CloudA',
			messageId: message.messageId,
			dequeueCount: message.dequeueCount,
			messageObject: messageObject,
		});
		return ok(true);
	}
}
