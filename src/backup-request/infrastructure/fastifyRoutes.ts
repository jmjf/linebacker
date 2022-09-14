import { PrismaContext } from '../../infrastructure/prisma/prismaContext';

import { RealFastifyReply, RealFastifyRequest, RealFastifyInstance } from '../../common/adapter/FastifyController';
import * as AdapterErrors from '../../common/adapter/AdapterErrors';
import { FastifyCreateBackupRequestController } from '../adapter/impl/FastifyCreateBackupRequestController';

import { initBackupRequestModule } from './initBackupRequestModulePrisma';
import { ICircuitBreakers } from '../../infrastructure/prisma/buildCircuitBreakers.prisma';

export function addBackupRequestRoutes(
	app: RealFastifyInstance,
	prismaCtx: PrismaContext,
	circuitBreakers: ICircuitBreakers
) {
	const { createBackupRequestController } = initBackupRequestModule(prismaCtx, circuitBreakers, 'Fastify');

	app.post('/api/backup-requests', async function (request: RealFastifyRequest, reply: RealFastifyReply) {
		let result = await (createBackupRequestController as FastifyCreateBackupRequestController).execute(
			request,
			reply
		);
		// HTTP status > 399 is an error
		if (reply.statusCode > 399) {
			app.log.error(result);
			const err = result as AdapterErrors.DatabaseError; // may not be a DatabaseError, but code deals with that
			const newResult = {
				code: err.code,
				message: err.name === 'DatabaseError' ? err.cleanMessage() : err.callerMessage,
			};
			result = newResult;
		}
		reply.send(result);
	});
}
