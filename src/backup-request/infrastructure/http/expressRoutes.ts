import { Application, Request, Response } from 'express';

import { PrismaContext } from '../../../common/infrastructure/database/prismaContext';

import { CreateBackupRequestUseCase } from '../../use-cases/create-backup-request/CreateBackupRequestUseCase';

import { PrismaBackupRequestRepo } from '../../adapter/impl/PrismaBackupRequestRepo';
import { ExpressCreateBackupRequestController } from '../../adapter/impl/ExpressCreateBackupRequestController';
import { BaseError } from '../../../common/core/BaseError';
import { DatabaseError } from '../../../common/adapter/AdapterErrors';

export function addBackupRequestRoutes(
	app: Application,
	prismaCtx: PrismaContext
) {
	const prismaBackupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);
	const createBackupRequestUseCase = new CreateBackupRequestUseCase(
		prismaBackupRequestRepo
	);
	const expressCreateBackupRequestController =
		new ExpressCreateBackupRequestController(createBackupRequestUseCase);

	app.post(
		'/backup-requests',
		async function (request: Request, response: Response) {
			let result = await expressCreateBackupRequestController.execute(
				request,
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
					message:
						typedResult instanceof DatabaseError
							? typedResult.cleanMessage()
							: typedResult.callerMessage,
				};
				result = newResult;
			}
			response.json(result).send();
		}
	);
}
