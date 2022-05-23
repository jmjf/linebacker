import { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import { backupRequestRepoFactory } from '../backup-request/test-utils/backupRequestRepoFactory';
import { CreateBackupRequestUseCase } from '../backup-request/use-cases/create-backup-request/CreateBackupRequestUseCase';
import { CreateBackupRequestController, HelloWorldController, SquareController } from './controllers';
import { HelloWorldUseCase, SquareUseCase } from './use-cases';

export async function routes(server: FastifyInstance, options: FastifyPluginOptions) {
   server.log.info(`called routes with options ${JSON.stringify(options)}`);

   server.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
      server.log.info('GET /');
      const useCase = new HelloWorldUseCase();
      const controller = new HelloWorldController(useCase);
      server.log.info('GET / calling controller.impl()');
      const result = await controller.impl(request, reply);
      server.log.info({ status: reply.statusCode, headers: reply.getHeaders(), result }, `GET / result`);
      reply.send(result);
   });

   server.get('/square/:x', async (request: FastifyRequest, reply: FastifyReply) => {
      server.log.info('GET /square/:x', JSON.stringify(request.params));
      const useCase = new SquareUseCase();
      const controller = new SquareController(useCase);
      server.log.info('GET /square/:x calling controller.impl()');
      await controller.impl(request, reply);
   });

   const createBackupRequestBodySchema = {
      type: 'object',
      required: ['apiVersion', 'backupJobId', 'dataDate', 'backupDataLocation'],
      properties: {
         apiVersion: { type: 'string' }, // yyyy-mm-dd
         backupJobId: { type: 'string' }, // UUIDv4
         dataDate: { type: 'string' }, // yyyy-mm-dd
         backupDataLocation: { type: 'string' }
      }
   };

   server.post('/backup-request', { schema: { body: createBackupRequestBodySchema } }, async (request: FastifyRequest, reply: FastifyReply) => {
      server.log.info('POST /backup-request', JSON.stringify(request.body));
      const repo = backupRequestRepoFactory();
      // const repo = backupRequestRepoFactory({failSave: true}); // use this repo to test 500 error
      const useCase = new CreateBackupRequestUseCase(repo);
      const controller = new CreateBackupRequestController(useCase);
      server.log.info('POST /backup-request calling controller.impl()');
      const result = await controller.impl(request, reply);
      server.log.info('POST /backup-request', { status: reply.statusCode, header: reply.getHeaders(), result });
      reply.send(result);

   });
}