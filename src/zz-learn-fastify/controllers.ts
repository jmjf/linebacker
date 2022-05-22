import { FastifyLoggerInstance, FastifyReply, FastifyRequest } from 'fastify';
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