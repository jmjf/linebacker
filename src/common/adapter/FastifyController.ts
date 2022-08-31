import {
	FastifyRequest,
	FastifyReply,
	FastifyInstance,
	FastifySchema,
	//FastifyTypeProvider,
} from 'fastify';
import { Http2SecureServer, Http2ServerRequest, Http2ServerResponse } from 'http2';
import { RouteGenericInterface } from 'fastify/types/route';

const responseTypes = {
	json: 'application/json',
	text: 'text/plan',
};

// fastify seems to require these types instead of the types FastifyRequest and FastifyReply
export type RealFastifyRequest = FastifyRequest<
	RouteGenericInterface,
	Http2SecureServer,
	Http2ServerRequest,
	FastifySchema //,
	//FastifyTypeProvider
>;
export type RealFastifyReply = FastifyReply<
	Http2SecureServer,
	Http2ServerRequest,
	Http2ServerResponse,
	RouteGenericInterface,
	unknown
>;
export type RealFastifyInstance = FastifyInstance<Http2SecureServer, Http2ServerRequest, Http2ServerResponse>;
export abstract class FastifyController {
	protected abstract execImpl(request: RealFastifyRequest, reply: RealFastifyReply): Promise<void | unknown>;

	public async execute(request: RealFastifyRequest, reply: RealFastifyReply): Promise<void | unknown> {
		try {
			return await this.execImpl(request, reply);
		} catch (e) {
			console.log(e);
		}
		return;
	}

	public replyOk<T>(reply: RealFastifyReply, dto?: T) {
		reply.status(200);
		if (dto) {
			reply.type(responseTypes.json);
		}
	}

	public replyAccepted<T>(reply: RealFastifyReply, dto?: T) {
		reply.status(202);
		if (dto) {
			reply.type(responseTypes.json);
		}
	}

	public replyBadRequest(reply: RealFastifyReply) {
		reply.status(400).type(responseTypes.json);
	}

	public replyServerError(reply: RealFastifyReply) {
		reply.status(500).type(responseTypes.json);
	}
}
