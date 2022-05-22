import { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import { HelloWorldController, SquareController } from './controllers';
import { HelloWorldUseCase, SquareUseCase } from './use-cases';

export async function routes(server: FastifyInstance, options: FastifyPluginOptions) {
   server.log.info(`called routes with options ${JSON.stringify(options)}`);

   server.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
      server.log.info('hello world');
      const useCase = new HelloWorldUseCase();
      const controller = new HelloWorldController(useCase);
      server.log.info('hello world calling controller.impl()');
      await controller.impl(request, reply);         
   });

   server.get('/square/:x', async (request: FastifyRequest, reply: FastifyReply) => {
      server.log.info('square', JSON.stringify(request.params));
      const useCase = new SquareUseCase();
      const controller = new SquareController(useCase);
      server.log.info('square calling controller.impl()');
      await controller.impl(request, reply);
   });
}