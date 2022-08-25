import { Result, ok } from '../../../common/core/Result';
import { StoreStatusReplyDTO } from '../../use-cases/receive-store-status-reply/StoreStatusReplyDTO';
import { IQueueMessageHandler, QueueMessageHandlerResponse } from '../IQueueMessageHandler';

export interface IAzureQueueCreateBackupReplyMessage {
	apiVersion: string; // yyyy-mm-dd
	backupRequestId: string; // -> UniqueIdentifier (UUIDv4)
	storagePathName: string;
	resultTypeCode: string; // -> ReplyResultType
	backupByteCount: number;
	copyStartTimestamp: string; // Date
	copyEndTimestamp: string; // Date
	verifyStartTimestamp?: string; // Date
	verifyEndTimestamp?: string; // Date
	verifiedHash?: string;
	messageText?: string;
}
export class AzureQueueCreateBackupReplyMessageHandler implements IQueueMessageHandler {
	private apiVersionDTOMappers = [
		{
			apiVersion: '2022-05-30',
			mapper: this.mapToDTO_20220530,
		},
	];

	public async processMessage(message: string): Promise<QueueMessageHandlerResponse> {
		let messageData: IAzureQueueCreateBackupReplyMessage;
		try {
			messageData = JSON.parse(message);
		} catch (e) {
			return { doesHandlerSucceed: false, opts: { error: 'Not JSON' } };
		}

		const mapper = this.getDTOMapperFor(messageData.apiVersion);
		if (typeof mapper !== 'function') {
			return { doesHandlerSucceed: false, opts: { error: 'Invalid apiVersion' } };
		}

		const dtoResult = mapper(messageData);

		if (dtoResult.isErr()) {
			return { doesHandlerSucceed: false, opts: { error: 'invalid message data' } };
		}

		return { doesHandlerSucceed: true };
	}

	private getDTOMapperFor(
		apiVersion: string
	): ((message: IAzureQueueCreateBackupReplyMessage) => Result<StoreStatusReplyDTO, Error>) | undefined {
		const res = this.apiVersionDTOMappers.find((v) => v.apiVersion === apiVersion);
		return res?.mapper;
	}

	private mapToDTO_20220530(message: IAzureQueueCreateBackupReplyMessage): Result<StoreStatusReplyDTO, Error> {
		const dto: StoreStatusReplyDTO = {
			backupRequestId: message.backupRequestId,
			storagePathName: message.storagePathName,
			resultTypeCode: message.resultTypeCode,
			backupByteCount: message.backupByteCount,
			copyStartTimestamp: message.copyEndTimestamp,
			copyEndTimestamp: message.copyEndTimestamp,
			verifyStartTimestamp: message.verifyStartTimestamp,
			verifyEndTimestamp: message.verifyEndTimestamp,
			verifiedHash: message.verifiedHash,
			messageText: message.messageText,
		};
		return ok(dto);
	}
}
