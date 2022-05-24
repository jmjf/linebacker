import { FastifyRequest, FastifyReply, fastify } from 'fastify';

import { IBackupRequestRepo } from '../../adapter/BackupRequestRepo';
import { CreateBackupRequestFastifyController, ICreateBackupRequestBody } from './CreateBackupRequestFastifyController';
import { CreateBackupRequestUseCase } from './CreateBackupRequestUseCase';

describe('CreateBackupRequestFastifyController', () => {
   const baseBody = {
      apiVersion: '2022-05-22',
      backupJobId: 'job-id',
      dataDate: '2022-05-30',
      backupDataLocation: 'data-location'
   } as ICreateBackupRequestBody;

   test('when apiVersion is invalid, it returns 400 and an error', async () => {
      // DOESN'T WORK: ts-ignore lets me index by Symbol, but it doesn't get me the objects I want.

      const f = fastify();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const request = f[Symbol('fastify.Request')];
      request.body = {
         ...baseBody,
         apiVersion: 'invalid' // override spread
      };
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const reply = f[Symbol('fastify.Reply')]; 

      // in this test, repo will never be used
      const repo = {} as IBackupRequestRepo;

      const useCase = new CreateBackupRequestUseCase(repo);

      const controller = new CreateBackupRequestFastifyController(useCase);

      const result = await controller.execute(request, reply);

      expect(reply.statusCode).toBe(400);
      expect(result.message).toMatch('apiVersion');

   });
});