import { Request, Application, Response, Router } from 'express';

import { TypeormContext } from '../../infrastructure/typeorm/typeormContext';
import { BaseError } from '../../common/core/BaseError';
import { DatabaseError } from '../../common/adapter/AdapterErrors';

import { ExpressCreateBackupRequestController } from '../adapter/impl/ExpressCreateBackupRequestController';
import { ExpressEnqueueBackupRequestController } from '../adapter/impl/ExpressEnqueueBackupRequestController';

import { initBackupRequestModule } from './initBackupRequestModuleTypeorm';
import { ICircuitBreakers } from '../../infrastructure/typeorm/buildCircuitBreakers.typeorm';
import { LinebackerRequest } from '../../common/adapter/ExpressController';
import { logger } from '../../infrastructure/logging/pinoLogger';
import path from 'node:path';

const moduleName = path.basename(module.filename);

export function getBackupRequestRouter(
	typeormCtx: TypeormContext,
	circuitBreakers: ICircuitBreakers,
	abortSignal: AbortSignal
) {
	const functionName = 'getBackupRequestRouter';
	const { createBackupRequestController, enqueueBackupRequestController } = initBackupRequestModule(
		typeormCtx,
		circuitBreakers,
		'Express',
		abortSignal
	);

	const router = Router();

	router.post('/', async (request: Request, response: Response) => {
		const customReq = request as LinebackerRequest;
		const clientScopes = customReq.clientScopes || [];
		if (clientScopes.includes('post-backup-request')) {
			// choose either
			// create controller -> direct to db
			// OR enqueue controller -> to queue

			// let result = await (createBackupRequestController as ExpressCreateBackupRequestController).execute(
			// 	customReq,
			// 	response
			// );

			let result = await (enqueueBackupRequestController as ExpressEnqueueBackupRequestController).execute(
				customReq,
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
		} else {
			logger.error(
				{
					jwtPayload: customReq.jwtPayload,
					clientScopes: customReq.clientScopes,
					body: request.body,
					method: 'POST',
					route: '/api/backup-requests',
					moduleName,
					functionName,
				},
				'Client not authorized'
			);
			response.status(403).send('Forbidden');
		}
	});

	return router;
}
