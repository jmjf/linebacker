import { PrismaContext } from '../../../common/infrastructure/database/prismaContext';
import { CreateBackupRequestUseCase } from '../../use-cases/create-backup-request/CreateBackupRequestUseCase';
import { FastifyCreateBackupRequestController } from '../../adapter/FastifyCreateBackupRequestController';
import { PrismaBackupRequestRepo } from '../../adapter/impl/PrismaBackupRequestRepo';
import { RealFastifyReply, RealFastifyRequest, RealFastifyInstance } from '../../../common/adapter/FastifyController';

export function addBackupRequestRoutes(app: RealFastifyInstance, prismaCtx: PrismaContext) {
   const prismaBackupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);
   const createBackupRequestUseCase = new CreateBackupRequestUseCase(prismaBackupRequestRepo);
   const fastifyCreateBackupRequestController = new FastifyCreateBackupRequestController(createBackupRequestUseCase);

   app.post('/backup-request', async function (request: RealFastifyRequest, reply: RealFastifyReply) {
      const result = await fastifyCreateBackupRequestController.execute(request, reply);
      if (reply.statusCode > 399) {
         app.log.error(result);
      }
      reply.send(result);
   });
}