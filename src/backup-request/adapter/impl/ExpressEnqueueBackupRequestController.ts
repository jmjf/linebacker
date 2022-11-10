import { Response } from 'express';
import { InvalidApiVersionError } from '../../../common/adapter/AdapterErrors';
import { ExpressController, LinebackerRequest } from '../../../common/adapter/ExpressController';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';
import { EnqueueBackupRequestUseCase } from '../../use-cases/enqueue-backup-request/EnqueueBackupRequestUseCase';

export interface IEnqueueBackupRequestBody {
	apiVersion: string;
	backupJobId: string;
	dataDate: string;
	backupDataLocation: string;
}

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);
export class ExpressEnqueueBackupRequestController extends ExpressController {
	private useCase: EnqueueBackupRequestUseCase;

	constructor(useCase: EnqueueBackupRequestUseCase) {
		super();
		this.useCase = useCase;
	}

	protected async execImpl(request: LinebackerRequest, response: Response): Promise<unknown> {
		const functionName = 'execImpl';
		const body = request.body as IEnqueueBackupRequestBody;
		const traceId = request.tracerizerTraceId;

		// TODO: create a different error for missing body
		// TODO: confirm apiVersion is a known version (in array of converter functions)
		if (!body || !body.apiVersion || body.apiVersion !== '2022-05-22') {
			this.logger.error({ apiVersion: body.apiVersion, moduleName, functionName, traceId }, 'Invalid apiVersion');
			this.respondBadRequest(response);
			return new InvalidApiVersionError('Invalid apiVersion', {
				apiVersion: body.apiVersion,
				moduleName,
				functionName,
				traceId,
			});
		}
		// ELSE by return above -- message body might be usable
		// TODO: get a converter function based on apiVersion (array of functions) and call it to get dto or fail (400)
		// TODO: real world: add middleware to get the requester's id from their OAuth token and include it
		const dto = {
			backupJobId: body.backupJobId,
			dataDate: body.dataDate,
			backupDataLocation: body.backupDataLocation,
			transportType: 'HTTP', // this is an HTTP controller
			getOnStartFlag: true,
			requesterId: request.jwtPayload.sub || '',
		};

		const result = await this.useCase.execute(dto);

		if (result.isOk()) {
			const { backupJobId, dataDate, ...v } = result.value.props;
			const dt = new Date(dataDate);
			const responseBody = {
				backupRequestId: result.value.id.value,
				backupJobId: (backupJobId as UniqueIdentifier).value,
				dataDate: dt.toISOString().slice(0, 10), // only the date part
				preparedDataPathName: v.preparedDataPathName,
				statusTypeCode: v.statusTypeCode,
				receivedTimestamp: v.receivedTimestamp,
				requesterId: v.requesterId,
			};
			this.logger.info(
				{ backupRequestId: responseBody.backupRequestId, moduleName, functionName, traceId },
				'BackupRequest created'
			);
			this.respondAccepted(response, responseBody);
			return responseBody;
		}
		// ELSE by return above -- handle error
		this.logger.error(
			{
				error: result.error,
				moduleName,
				functionName,
				traceId,
			},
			result.error.name
		);
		switch (result.error.name) {
			case 'PropsError':
				this.respondBadRequest(response);
				break;
			default:
				this.respondServerError(response);
				break;
		}
		return result.error;
	}
}
