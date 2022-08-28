import { InvalidApiVersionError } from '../../../common/adapter/AdapterErrors';
import { FastifyController, RealFastifyRequest, RealFastifyReply } from '../../../common/adapter/FastifyController';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';
import { logger } from '../../../common/infrastructure/pinoLogger';
import { CreateBackupRequestUseCase } from '../../use-cases/create-backup-request/CreateBackupRequestUseCase';

export interface ICreateBackupRequestBody {
	apiVersion: string;
	backupJobId: string;
	dataDate: string;
	backupDataLocation: string;
}

export class FastifyCreateBackupRequestController extends FastifyController {
	private useCase: CreateBackupRequestUseCase;

	constructor(useCase: CreateBackupRequestUseCase) {
		super();
		this.useCase = useCase;
	}

	protected async execImpl(request: RealFastifyRequest, reply: RealFastifyReply): Promise<any> {
		const logContext = {
			context: 'FastifyCreateBackupRequestController.execImpl',
			fastifyRequestId: request.id,
		};
		const body = <ICreateBackupRequestBody>request.body;
		logger.info({
			...logContext,
			requestBody: body,
			msg: 'start',
		});

		if (!body.apiVersion || body.apiVersion !== '2022-05-22') {
			this.replyBadRequest(reply);
			const err = new InvalidApiVersionError(`{ message: 'invalid apiVersion', apiVersion: ${body.apiVersion} }`);
			logger.error({
				...logContext,
				error: err,
				msg: 'InvalidApiVersionError',
			});
			return err;
		} else {
			const dto = {
				...body,
				transportType: 'HTTP', // this is an HTTP controller
				getOnStartFlag: true,
			};

			logger.info({ ...logContext, dto: dto, msg: 'execute use case' });
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
				logger.info({
					...logContext,
					reply: replyValue,
					msg: 'reply isOk',
				});

				this.replyAccepted(reply);
				return replyValue;
			}
			// else isErr()
			logger.error({
				...logContext,
				error: result.error,
				msg: 'reply isErr',
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
