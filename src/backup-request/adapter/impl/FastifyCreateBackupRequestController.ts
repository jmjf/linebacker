import { InvalidApiVersionError } from '../../../common/adapter/AdapterErrors';
import { FastifyController, RealFastifyRequest, RealFastifyReply } from '../../../common/adapter/FastifyController';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';
import { logger } from '../../../infrastructure/pinoLogger';
import { CreateBackupRequestUseCase } from '../../use-cases/create-backup-request/CreateBackupRequestUseCase';

export interface ICreateBackupRequestBody {
	apiVersion: string;
	backupJobId: string;
	dataDate: string;
	backupDataLocation: string;
}

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);

export class FastifyCreateBackupRequestController extends FastifyController {
	private useCase: CreateBackupRequestUseCase;

	constructor(useCase: CreateBackupRequestUseCase) {
		super();
		this.useCase = useCase;
	}

	protected async execImpl(request: RealFastifyRequest, reply: RealFastifyReply): Promise<unknown> {
		const functionName = 'execImpl';
		const fastifyRequestId = request.id;
		const body = <ICreateBackupRequestBody>request.body;
		logger.debug({
			fastifyRequestId,
			requestBody: body,
			msg: 'start',
			moduleName,
			functionName,
		});

		if (!body.apiVersion || body.apiVersion !== '2022-05-22') {
			this.replyBadRequest(reply);
			const err = new InvalidApiVersionError('Invalid apiVersion', {
				apiVersion: body.apiVersion,
				moduleName,
				functionName,
			});
			logger.error({
				fastifyRequestId,
				msg: 'InvalidApiVersionError',
				apiVersion: body.apiVersion,
				moduleName,
				functionName,
			});
			return err;
		} else {
			const dto = {
				...body,
				transportType: 'HTTP', // this is an HTTP controller
				getOnStartFlag: true,
			};

			logger.debug({ fastifyRequestId, dto: dto, msg: 'execute use case' });
			const result = await this.useCase.execute(dto);

			if (result.isOk()) {
				const { backupJobId, dataDate, ...v } = result.value.props;
				const dt = new Date(dataDate);
				const replyValue = {
					backupRequestId: result.value.id.value,
					backupJobId: (backupJobId as UniqueIdentifier).value,
					dataDate: dt.toISOString().slice(0, 10), // only the date part
					preparedDataPathName: v.preparedDataPathName,
					statusTypeCode: v.statusTypeCode,
					receivedTimestamp: v.receivedTimestamp,
					requesterId: v.requesterId,
				};
				logger.debug({
					fastifyRequestId,
					reply: replyValue,
					msg: 'BackupRequest created',
					moduleName,
					functionName,
				});

				this.replyAccepted(reply);
				return replyValue;
			}
			// else isErr()
			logger.error({
				fastifyRequestId,
				error: result.error,
				msg: 'reply isErr',
				moduleName,
				functionName,
			});
			switch (result.error.name) {
				case 'PropsError':
					this.replyBadRequest(reply);
					break;
				default:
					this.replyServerError(reply);
					break;
			}
			return result.error;
		}
	}
}
