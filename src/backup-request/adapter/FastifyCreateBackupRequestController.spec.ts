import { FastifyRequest, FastifyReply, fastify } from 'fastify';

import { CreateBackupRequestFastifyController, ICreateBackupRequestBody } from './FastifyCreateBackupRequestController';
import { CreateBackupRequestUseCase } from '../use-cases/create-backup-request/CreateBackupRequestUseCase';

import { MockPrismaContext, PrismaContext, createMockPrismaContext } from '../../common/infrastructure/database/prismaContext';
import { BackupRequest } from '@prisma/client';
import { PrismaBackupRequestRepo } from './impl/PrismaBackupRequestRepo';

describe('CreateBackupRequestFastifyController', () => {
   let mockPrismaCtx: MockPrismaContext;
   let prismaCtx: PrismaContext;

   beforeEach(() => {
      mockPrismaCtx = createMockPrismaContext();
      prismaCtx = mockPrismaCtx as unknown as PrismaContext;
    });

   const baseBody = {
      apiVersion: '2022-05-22',
      backupJobId: 'job-id',
      dataDate: '2022-05-30',
      backupDataLocation: 'data-location'
   } as ICreateBackupRequestBody;

   test('when apiVersion is invalid, it returns 400 and an error', async () => {
      const backupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);

      const useCase = new CreateBackupRequestUseCase(backupRequestRepo);

      const controller = new CreateBackupRequestFastifyController(useCase);

      

      

      // const result = await controller.execute(request, reply);

      // expect(reply.statusCode).toBe(400);
      // expect(result.message).toMatch('apiVersion');

   });
});