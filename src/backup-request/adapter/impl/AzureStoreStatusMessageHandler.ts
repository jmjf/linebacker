import { ReceivedMessageItem } from '@azure/storage-queue';

import { Result, ok, err } from '../../../common/core/Result';
import { IStoreStatusMessageHandler } from '../IStoreStatusMessageHandler';

import { StoreStatusMessage, StoreStatusMessageItem, StoreStatusReceived } from '../../domain/StoreStatusReceived.event';

import * as AdapterErrors from '../../../common/adapter/AdapterErrors';
import { logger } from '../../../infrastructure/logging/pinoLogger';
import { eventBus } from '../../../common/infrastructure/event-bus/eventBus';

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);

export class AzureStoreStatusMessageHandler implements IStoreStatusMessageHandler {
	async processMessage(
		message: ReceivedMessageItem,
		opts?: unknown
	): Promise<Result<boolean, AdapterErrors.StatusJsonError>> {
		const functionName = 'processMessage';
		let messageObject: StoreStatusMessage;

		try {
			messageObject = JSON.parse(message.messageText);
		} catch (e) {
			logger.error({
				msg: 'Unparseable messageText JSON in queue message',
				providerType: 'CloudA',
				messageId: message.messageId,
				dequeueCount: message.dequeueCount,
				messageText: message.messageText,
				moduleName,
				functionName,
			});
			if (message.dequeueCount >= 4) {
				// TODO: store it and delete it
				console.log('TODO store message, delete message from queue');
			}
			return err(
				new AdapterErrors.StatusJsonError('Unparseable messageText JSON in queue message', {
					messageId: message.messageId,
					moduleName,
					functionName,
				})
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

		eventBus.publishEvent(event);

		logger.info({
			msg: 'Published StoreStatusReceived event',
			providerType: 'CloudA',
			messageId: message.messageId,
			dequeueCount: message.dequeueCount,
			messageObject: messageObject,
			moduleName,
			functionName,
		});
		return ok(true);
	}
}
