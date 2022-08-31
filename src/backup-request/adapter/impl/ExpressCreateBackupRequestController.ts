import { Response } from 'express';
import { InvalidApiVersionError } from '../../../common/adapter/AdapterErrors';
import { ExpressController, LinebackerRequest } from '../../../common/adapter/ExpressController';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';
import { CreateBackupRequestUseCase } from '../../use-cases/create-backup-request/CreateBackupRequestUseCase';

export interface ICreateBackupRequestBody {
	apiVersion: string;
	backupJobId: string;
	dataDate: string;
	backupDataLocation: string;
}

export class ExpressCreateBackupRequestController extends ExpressController {
	private useCase: CreateBackupRequestUseCase;

	constructor(useCase: CreateBackupRequestUseCase) {
		super();
		this.useCase = useCase;
	}

	protected async execImpl(request: LinebackerRequest, response: Response): Promise<unknown> {
		const body = request.body as ICreateBackupRequestBody;
		const traceId = request.hrTimeTraceId;

		// TODO: create a different error for missing body
		// TODO: confirm apiVersion is a known version (in array of converter functions)
		if (!body || !body.apiVersion || body.apiVersion !== '2022-05-22') {
			this.logger.error({ apiVersion: body.apiVersion, traceId }, 'Invalid apiVersion');
			this.respondBadRequest(response);
			return new InvalidApiVersionError(`{ message: 'invalid apiVersion', apiVersion: ${body.apiVersion} }`);
		}
		// ELSE by return above -- message body might be usable
		// TODO: get a converter function based on apiVersion (array of functions) and call it to get dto or fail (400)
		// TODO: real world: add middleware to get the requester's id from their OAuth token and include it
		const dto = {
			...body,
			transportType: 'HTTP', // this is an HTTP controller
			getOnStartFlag: true,
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
			this.logger.info({ traceId, backupRequestId: responseBody.backupRequestId }, 'BackupRequest created');
			this.respondAccepted(response, responseBody);
			return responseBody;
		}
		// ELSE by return above -- handle error
		this.logger.error(
			{ traceId, errorName: result.error.name, errorMessage: result.error.message, cause: result.error.cause },
			`${result.error.name}`
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
