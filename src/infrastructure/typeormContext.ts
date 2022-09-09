// Provides deep mocking of parts of TypeORM
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { EntityManager } from 'typeorm';

// Import your TypeORM DataSource object here for real context
import { typeormDataSource } from '../typeorm/typeormDataSource';

// Patterned on Prisma's recommendation for testing, but changed for TypeORM
// I'm using EntityManager. TypeORM's Repository is aimed at building the
// repo intelligence into a TypeORM construct, which makes changing ORM harder.
// I started with Prisma, needed to support TypeORM and, because my repo for
// Prisma was not a Prisma construct, switching was trivial. If I'd started
// with a TypeORM Repository and built intelligence into that, I'd need to
// build a repo to support Prisma. Beware of "features" that push the adapter
// layer into the framework.
//
// UNTESTED: Replacing manager with repository or customRepository and
// EntityManager with Repository or CustomRepository would probably work if I
// chose to use Repository/CustomRepository.
//

// Type for a real context that connects to the database
export type TypeormContext = {
	manager: EntityManager;
};

// Type for a mock context for testing
export type MockTypeormContext = {
	manager: DeepMockProxy<EntityManager>;
};

// In tests, use this function in a beforeEach() to get a mocked context.
export const createMockTypeormContext = (): MockTypeormContext => {
	return {
		manager: mockDeep<EntityManager>(),
	};
};

export const typeormCtx: TypeormContext = { manager: typeormDataSource.manager };
