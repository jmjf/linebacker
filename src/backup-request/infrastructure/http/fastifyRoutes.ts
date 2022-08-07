import { PrismaContext } from '../../../common/infrastructure/database/prismaContext';
import { CreateBackupRequestUseCase } from '../../use-cases/create-backup-request/CreateBackupRequestUseCase';
import { FastifyCreateBackupRequestController } from '../../adapter/impl/FastifyCreateBackupRequestController';
import { PrismaBackupRequestRepo } from '../../adapter/impl/PrismaBackupRequestRepo';
import {
	RealFastifyReply,
	RealFastifyRequest,
	RealFastifyInstance,
} from '../../../common/adapter/FastifyController';

export function addBackupRequestRoutes(
	app: RealFastifyInstance,
	prismaCtx: PrismaContext
) {
	const prismaBackupRequestRepo = new PrismaBackupRequestRepo(prismaCtx);
	const createBackupRequestUseCase = new CreateBackupRequestUseCase(
		prismaBackupRequestRepo
	);
	const fastifyCreateBackupRequestController =
		new FastifyCreateBackupRequestController(createBackupRequestUseCase);

	app.post(
		'/backup-requests',
		async function (request: RealFastifyRequest, reply: RealFastifyReply) {
			let result = await fastifyCreateBackupRequestController.execute(
				request,
				reply
			);
			// HTTP status > 399 is an error
			if (reply.statusCode > 399) {
				app.log.error(result);
				const newResult = {
					code: result.code,
					message:
						result.name === 'DatabaseError'
							? result.cleanMessage()
							: result.callerMessage,
				};
				result = newResult;
			}
			reply.send(result);
		}
	);
}
