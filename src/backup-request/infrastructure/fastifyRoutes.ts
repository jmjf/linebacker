import { PrismaContext } from '../../common/infrastructure/database/prismaContext';

import { FastifyCreateBackupRequestController } from '../adapter/impl/FastifyCreateBackupRequestController';
import { RealFastifyReply, RealFastifyRequest, RealFastifyInstance } from '../../common/adapter/FastifyController';
import { initBackupRequestModule } from './initBackupRequestModulePrisma';

export function addBackupRequestRoutes(app: RealFastifyInstance, prismaCtx: PrismaContext) {
	const { createBackupRequestController } = initBackupRequestModule(prismaCtx, 'Fastify');

	app.post('/api/backup-requests', async function (request: RealFastifyRequest, reply: RealFastifyReply) {
		let result = await (createBackupRequestController as FastifyCreateBackupRequestController).execute(
			request,
			reply
		);
		// HTTP status > 399 is an error
		if (reply.statusCode > 399) {
			app.log.error(result);
			const newResult = {
				code: result.code,
				message: result.name === 'DatabaseError' ? result.cleanMessage() : result.callerMessage,
			};
			result = newResult;
		}
		reply.send(result);
	});
}
