import { FastifyLoggerInstance, FastifyReply, FastifyRequest } from 'fastify';
import { CreateRequestUseCase } from '../backup-request/use-cases/create-request/CreateRequestUseCase';
import { CreateRequestDTO } from '../backup-request/use-cases/create-request/CreateRequestDTO';
import { HelloWorldUseCase, ISquareDTO, SquareUseCase } from './use-cases';

export interface IController {
   impl(request: FastifyRequest, reply: FastifyReply, log: FastifyLoggerInstance): Promise<any>
}

export class HelloWorldController implements IController {
   private useCase: HelloWorldUseCase;

   constructor(useCase: HelloWorldUseCase) {
      this.useCase = useCase;
   }

   async impl(request: FastifyRequest, reply: FastifyReply): Promise<any> {
      const result = await this.useCase.execute();

      if (result.isOk()) {
         reply
            .code(200)
            .header('Content-Type', 'application/json')
            .send(result.value);
      } else {
         reply
            .code(400)
            .header('Content-Type', 'application/json')
            .send(result.error);
      }
   }
}

export class SquareController implements IController {
   private useCase: SquareUseCase;

   constructor(useCase: SquareUseCase) {
      this.useCase = useCase;
   }

   async impl(request: FastifyRequest, reply: FastifyReply): Promise<any> {
      if (!Object.keys(request.params as object).includes('x')) {
         reply
            .code(400)
            .send('missing parameter x');
      } else {

         const dto = request.params as ISquareDTO;

         const result = await this.useCase.execute(dto);

         if (result.isOk()) {
            reply
               .code(200)
               .header('Content-Type', 'application/json')
               .send(result.value);
         } else { 
            // BaseController has methods to handle different types of errors and set the right reply values
            // this becomes a switch on typeof result.error and calls the corresponding BaseController method
            // but we only have one error type here and don't have BaseController yet, so that's overkill
            reply
               .code(400)
               .header('Content-Type', 'application/json')
               .send(result.error);
         }
      }
   }
}

export class CreateBackupRequestController implements IController {
   private useCase: CreateRequestUseCase;

   constructor(useCase: CreateRequestUseCase) {
      this.useCase = useCase;
   }

   async impl(request: FastifyRequest, reply: FastifyReply): Promise<any> {
      const body = request.body as CreateRequestDTO;

      if (!body.apiVersion || body.apiVersion !== '2022-05-22') {
         reply
            .code(400)
            .send(`missing or invalid apiVersion ${body.apiVersion}`);
      } else {

         const dto = {
            ...body,
            transportType: 'HTTP', // this is an HTTP controller
            getOnStartFlag: true
         };

         const result = await this.useCase.execute(dto);

         if (result.isOk()) {
            const { backupJobId, dataDate, ...v } = result.value.props;
            const dt = new Date(dataDate);
            const replyValue = {
               backupRequestId: result.value.id.value,
               backupJobId: backupJobId.value,
               dataDate: dt.toISOString().slice(0,10),
               preparedDatePathName: v.preparedDataPathName,
               statusTypeCode: v.statusTypeCode,
               receivedTimestamp: v.receivedTimestamp,
               requesterId: v.requesterId
            };

            reply
               .code(200)
               .header('Content-Type', 'application/json')
               .send(replyValue);
         } else {
            let statusCode: number;
            switch(result.error.name) {
               case 'PropsError':
                  statusCode = 400;
                  break;
               default:
                  statusCode = 500;
                  break;
            }
            // BaseController has methods to handle different types of errors and set the right reply values
            // this becomes a switch on typeof result.error and calls the corresponding BaseController method
            // but we only have one error type here and don't have BaseController yet, so that's overkill
            reply
               .code(statusCode)
               .header('Content-Type', 'application/json')
               .send(result.error);
         }
      }
   }
}