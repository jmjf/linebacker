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

      try {
         const body = JSON.parse(response.body);
         // Assert
         expect(response.statusCode).toBe(400);
         expect(body.message).toMatch('apiVersion');
      } catch (e) {
         //JSON.parse(response.body) failed
         expect(false).toBe(true);
      }
   });
});