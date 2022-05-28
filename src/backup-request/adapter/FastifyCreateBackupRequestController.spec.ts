import { buildApp } from '../../app';

import { ICreateBackupRequestBody } from './FastifyCreateBackupRequestController';

import { MockPrismaContext, PrismaContext, createMockPrismaContext } from '../../common/infrastructure/database/prismaContext';

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
      // convert body to an object we can use
      const body = JSON.parse(response.body);
      
      expect(response.statusCode).toBe(400);
      expect(body.code).toMatch('InvalidApiVersion');
   });
});