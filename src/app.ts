import fastify from 'fastify';

import { addBackupRequestRoutes } from './backup-request/infrastructure/http/fastifyRoutes';
import { PrismaContext } from './common/infrastructure/database/prismaContext';

export function buildApp(opts: any = {}, prismaCtx: PrismaContext) {
   const app = fastify(opts);

   addBackupRequestRoutes(app, prismaCtx);

   return app;
}