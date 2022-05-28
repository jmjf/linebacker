import { buildApp } from '../../app';

import { ICreateBackupRequestBody } from './FastifyCreateBackupRequestController';

import { MockPrismaContext, PrismaContext, createMockPrismaContext } from '../../common/infrastructure/database/prismaContext';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime';

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
      // Arrange
      const app = buildApp(prismaCtx);

      // Act
      const response = await app.inject({
         method: 'POST',
         url: '/backup-request',
         payload: {
            ...baseBody,
            apiVersion: 'invalid'
         }
      });

      // Assert
      expect(response.statusCode).toBe(400);
      // convert body to an object we can use -- may throw an error if body isn't JSON
      const body = JSON.parse(response.body);
      expect(body.code).toMatch('InvalidApiVersion');
   });

   test('when the use case gets a database error, the controller returns 500 and an error', async () => {
      // Arrange
      // simulate a database error
      const prismaCode = 'P1012';
      mockPrismaCtx.prisma.backupRequest.upsert.mockRejectedValue(new PrismaClientKnownRequestError('Key is already defined', prismaCode, '2'));
      const app = buildApp(prismaCtx);

      // Act
      const response = await app.inject({
         method: 'POST',
         url: '/backup-request',
         payload: {
            ...baseBody
         }
      });

      // Assert
      expect(response.statusCode).toBe(500);
      // convert body to an object we can use -- may throw an error if body isn't JSON
      const body = JSON.parse(response.body);
      expect(body.code).toMatch('Database');
      expect(body.message).toBe(prismaCode.slice(1));      // ensure message is clean
   });
});