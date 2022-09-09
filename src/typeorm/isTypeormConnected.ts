import { BaseError } from '../common/core/BaseError';
import { Result, ok, err } from '../common/core/Result';
import { DatabaseError } from '../common/adapter/AdapterErrors';
import { typeormCtx } from '../infrastructure/typeormContext';

export async function isTypeormConnected(): Promise<Result<boolean, BaseError>> {
	try {
		await typeormCtx.manager.connection.query('select 1 where 1 = 1');
		return ok(true);
	} catch (e) {
		return err(new DatabaseError('Connection error'));
	}
}
