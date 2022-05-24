import { FastifyRequest, FastifyReply } from 'fastify';
import { InvalidApiVersionError } from '../../../common/adapter/AdapterErrors';
import { FastifyController } from '../../../common/adapter/FastifyController';
import { CreateBackupRequestUseCase } from './CreateBackupRequestUseCase';

export interface ICreateBackupRequestBody {
   apiVersion: string,
   backupJobId: string,
   dataDate: string,
   backupDataLocation: string
};

export class CreateBackupRequestFastifyController extends FastifyController {
   private useCase: CreateBackupRequestUseCase;

   constructor(useCase: CreateBackupRequestUseCase) {
      super();
      this.useCase = useCase;
   }

   protected async execImpl(request: FastifyRequest, reply: FastifyReply): Promise<any> {
      return {};
      // const body = <ICreateBackupRequestBody>request.body;

      // if (!body.apiVersion || body.apiVersion !== '2022-05-22') {
      //    this.replyBadRequest(reply);
      //    return new InvalidApiVersionError(`{ message: 'invalid apiVersion', apiVersion: ${body.apiVersion} }`);
      // } else {

      //    const dto = {
      //       ...body,
      //       transportType: 'HTTP', // this is an HTTP controller
      //       getOnStartFlag: true
      //    };

      //    const result = await this.useCase.execute(dto);

      //    if (result.isOk()) {
      //       const { backupJobId, dataDate, ...v } = result.value.props;
      //       const dt = new Date(dataDate);
      //       const replyValue = {
      //          backupRequestId: result.value.id.value,
      //          backupJobId: backupJobId.value,
      //          dataDate: dt.toISOString().slice(0,10), // only the date part
      //          preparedDatePathName: v.preparedDataPathName,
      //          statusTypeCode: v.statusTypeCode,
      //          receivedTimestamp: v.receivedTimestamp,
      //          requesterId: v.requesterId
      //       };

      //       this.replyAccepted(reply);
      //       return replyValue;
      //    } else {
      //       switch(result.error.name) {
      //          case 'PropsError':
      //             this.replyBadRequest(reply);
      //             break;
      //          default:
      //             this.replyServerError(reply);
      //             break;
      //       }
      //       return result.error;
      //    }
      // }      
   }
}