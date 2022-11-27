import { ReceivedMessageItem } from '@azure/storage-queue';

import { Result, ok, err } from '../../../common/core/Result';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';
import { eventBus, eventBusType } from '../../../common/infrastructure/event-bus/eventBus';
import { EventBusError } from '../../../common/infrastructure/InfrastructureErrors';
import { EventBusEvent } from '../../../common/infrastructure/event-bus/IEventBus';

import { StoreStatusReceived_BMQ } from '../../domain/StoreStatusReceived.bmq';
import { StoreStatusReceived_MEM } from '../../domain/StoreStatusReceived.mem';
import { StoreStatusMessage, StoreStatusMessageItem } from '../../domain/StoreStatusReceived.common';

import { logger } from '../../../infrastructure/logging/pinoLogger';

import { IStoreStatusMessageHandler } from '../IStoreStatusMessageHandler';
import { IBackupInterfaceStoreAdapter } from '../IBackupInterfaceStoreAdapter';

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);

export class AzureStoreStatusMessageHandler implements IStoreStatusMessageHandler {
	private interfaceAdapter: IBackupInterfaceStoreAdapter;

	constructor(interfaceAdapter: IBackupInterfaceStoreAdapter) {
		this.interfaceAdapter = interfaceAdapter;
	}

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
		const eventData: StoreStatusMessageItem = {
			messageId: message.messageId,
			popReceipt: message.popReceipt,
			dequeueCount: message.dequeueCount,
			messageObject: messageObject,
		};
		//console.log('assmh eventMessage', eventMessage);

		let event;
		if (eventBusType === 'bullmq') {
			event = new StoreStatusReceived_BMQ(eventData);
		} else {
			event = new StoreStatusReceived_MEM(eventData);
		}

		const publishResult = await eventBus.publishEvent(event);

		if (eventBusType === 'bullmq') {
			await this._deleteAzureMessage(publishResult, eventData);
		}

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

	private async _deleteAzureMessage(
		publishResult: Result<EventBusEvent<unknown>, EventBusError>,
		eventData: StoreStatusMessageItem
	) {
		if (publishResult.isOk() || eventData.dequeueCount >= 5) {
			const logContext = { moduleName, functionName: '_handlePublishResult' };
			const deleteResult = await this.interfaceAdapter.delete(eventData.messageId, eventData.popReceipt);
			logger.info(
				{
					...logContext,
					backupRequestId: eventData.messageObject.backupRequestId,
					messageId: eventData.messageId,
					popReceipt: eventData.popReceipt,
					dequeueCount: eventData.dequeueCount,
					deleteIsOkFlag: deleteResult.isOk(),
				},
				`'${deleteResult.isOk() ? 'Deleted' : 'Failed to delete'} queue message'`
			);
		}
	}
}
