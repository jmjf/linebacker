import { Application, Request, Response } from 'express';

import { PrismaContext } from '../../infrastructure/prisma/prismaContext';
import { BaseError } from '../../common/core/BaseError';
import { DatabaseError } from '../../common/adapter/AdapterErrors';

import { ExpressCreateBackupRequestController } from '../adapter/impl/ExpressCreateBackupRequestController';
import { initBackupRequestModule } from './initBackupRequestModulePrisma';
import { ICircuitBreakers } from '../../infrastructure/typeorm/buildCircuitBreakers.typeorm';
import { LinebackerRequest } from '../../common/adapter/ExpressController';

export function addBackupRequestRoutes(
	app: Application,
	prismaCtx: PrismaContext,
	circuitBreakers: ICircuitBreakers,
	abortSignal: AbortSignal
) {
	const { createBackupRequestController } = initBackupRequestModule(
		prismaCtx,
		circuitBreakers,
		'Express',
		abortSignal
	);

	app.post('/api/backup-requests', async function (request: Request, response: Response) {
		let result = await (createBackupRequestController as ExpressCreateBackupRequestController).execute(
			request as LinebackerRequest,
			response
		);

		// HTTP status > 399 is an error
		if (response.statusCode > 399) {
			// need to figure out logging app.log.error(result);

			// result must be cast to use because it's declared unknown in the controller
			// most errors have the same properties as BaseError
			// instanceof below type guards DatabaseError, which includes a message cleaner
			// if other errors have cleaners, type guard for them separately
			const typedResult = result as BaseError;
			const newResult = {
				code: typedResult.code,
				message: typedResult instanceof DatabaseError ? typedResult.cleanMessage() : typedResult.callerMessage,
			};
			result = newResult;
		}
		response.json(result).send();
	});
}
