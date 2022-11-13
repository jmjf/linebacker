import { Message } from 'kafkajs';
import path from 'path';

import {
	IBusMessageHandler,
	BusMessageHandlerResult,
	BusMessageHandlerResultType,
} from '../../../common/messaging/MessageBus';
import { logger } from '../../../infrastructure/logging/pinoLogger';

import { KBackupRequestAcceptedData } from '../../domain/KBackupRequestAccepted';
import { ReceiveBackupRequestUseCase } from '../../use-cases/receive-backup-request/ReceiveBackupRequestUseCase';

const moduleName = path.basename(module.filename);

export class KBackupRequestAcceptedMessageHandler implements IBusMessageHandler {
	// TODO: Correct types
	private _useCase: ReceiveBackupRequestUseCase;

	constructor(useCase: ReceiveBackupRequestUseCase) {
		this._useCase = useCase;
	}

	public async onMessage(message: Message): Promise<BusMessageHandlerResultType> {
		const functionName = 'onMessage';
		const logContext = { moduleName, functionName, messageKey: message.key };

		if (message.value === null) return BusMessageHandlerResult.Error;

		let messageData: KBackupRequestAcceptedData;

		try {
			messageData = JSON.parse(message.value.toString());
		} catch (e) {
			logger.error({ ...logContext, error: e, messageValue: message.value }, 'JSON parse error');
			return BusMessageHandlerResult.Error;
		}

		// Check service status ????

		logger.trace({ ...logContext, messageData }, 'Execute use case');
		try {
			const dto: KBackupRequestAcceptedData = {
				backupRequestId: messageData.backupRequestId,
				backupJobId: messageData.backupJobId,
				dataDate: messageData.dataDate,
				preparedDataPathName: messageData.preparedDataPathName,
				receivedTimestamp: messageData.receivedTimestamp,
				transportTypeCode: messageData.transportTypeCode,
				getOnStartFlag: messageData.getOnStartFlag,
				requesterId: messageData.requesterId,
				statusTypeCode: messageData.statusTypeCode,
			};
			const result = await this._useCase.execute(dto);

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
					'ReceiveRequest use case ok'
				);
				return BusMessageHandlerResult.Ok;
			} else {
				logger.error(
					{
						...logContext,
						resultType: 'error',
						error: result.error,
					},
					'ReceiveRequest use case error'
				);

				// TODO: add connect failure vs. other failure detection; connect failure returns BusMessageHandlerResult.Retry

				// const errorData = result.error.errorData as ConnectFailureErrorData;
				// if (errorData.isConnectFailure) {
				//    if (errorData.serviceName && errorData.isConnected && !this.failedServices[errorData.serviceName]) {
				//       this.failedServices[errorData.serviceName] = { isConnected: undefined, addRetryEvent: undefined };
				//       this.failedServices[errorData.serviceName].isConnected = errorData.isConnected;
				//       this.failedServices[errorData.serviceName].addRetryEvent = errorData.addRetryEvent;
				//    }
				//    if (errorData.addRetryEvent) {
				//       event.retryCount++;
				//       errorData.addRetryEvent(event);
				//    }
				// }
			}
		} catch (e) {
			const { message, ...error } = e as Error;
			logger.error({ ...logContext, messageData, error }, message);
		}

		return BusMessageHandlerResult.Error;
	}
}
