import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

export type PrismaContext = {
  prisma: PrismaClient
};

export type MockPrismaContext = {
  prisma: DeepMockProxy<PrismaClient>
};

export const createMockPrismaContext = (): MockPrismaContext => {
  return {
    prisma: mockDeep<PrismaClient>(),
  };
};

