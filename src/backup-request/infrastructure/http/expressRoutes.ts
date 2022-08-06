import { Application, Request, Response } from 'express';

import { PrismaContext } from '../../../common/infrastructure/database/prismaContext';

import { CreateBackupRequestUseCase } from '../../use-cases/create-backup-request/CreateBackupRequestUseCase';

import { PrismaBackupRequestRepo } from '../../adapter/impl/PrismaBackupRequestRepo';
import { ExpressCreateBackupRequestController } from '../../adapter/impl/ExpressCreateBackupRequestController';

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
		'/backup-request',
		async function (request: Request, response: Response) {
			let result = await expressCreateBackupRequestController.execute(
				request,
				response
			);

			// HTTP status > 399 is an error
			if (response.statusCode > 399) {
				// need to figure out logging app.log.error(result);

				const newResult = {
					code: result.code,
					message:
						result.name === 'DatabaseError'
							? result.cleanMessage()
							: result.callerMessage,
				};
				result = newResult;
			}
			response.json(result).send();
		}
	);
}
