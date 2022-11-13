import { Message } from 'kafkajs';
import path from 'path';

import { UseCase } from '../../common/application/UseCase';

import {
	IBusMessageHandler,
	BusMessageHandlerResult,
	BusMessageHandlerResultType,
} from '../../common/messaging/MessageBus';
import { logger } from '../../infrastructure/logging/pinoLogger';

import { KBackupRequestAcceptedData } from '../../backup-request/domain/KBackupRequestAccepted';
// import { ReceiveBackupRequestUseCase } from '../../backup-request/use-cases/receive-backup-request/ReceiveBackupRequestUseCase';

const moduleName = path.basename(module.filename);

// Simple use case to console.log whatever is passed; lets me use most of the base message handler code
class ConsoleUseCase implements UseCase<any[], void> {
	execute(args: any[]): void {
		console.log(...args);
	}
}

export class ConsoleMessageHandler implements IBusMessageHandler {
	// TODO: Correct types
	private _useCase: ConsoleUseCase;

	constructor() {
		this._useCase = new ConsoleUseCase();
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
			const result = this._useCase.execute(['execute', dto]);

			return BusMessageHandlerResult.Ok;
		} catch (e) {
			const { message, ...error } = e as Error;
			logger.error({ ...logContext, messageData, error }, message);
		}

		return BusMessageHandlerResult.Error;
	}
}
