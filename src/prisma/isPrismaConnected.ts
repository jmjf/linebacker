import { BaseError } from '../common/core/BaseError';
import { Result, ok, err } from '../common/core/Result';
import { DatabaseError } from '../common/adapter/AdapterErrors';

import { prismaCtx } from '../infrastructure/prismaContext';

export async function isPrismaConnected(): Promise<Result<boolean, BaseError>> {
	try {
		await prismaCtx.prisma.$queryRaw`select 1 where 1 = 1`;
		return ok(true);
	} catch (e) {
		return err(new DatabaseError('Connection error'));
	}
}
