import { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';

export async function routes(server: FastifyInstance, options: FastifyPluginOptions) {
   server.log.info(`called routes with options ${JSON.stringify(options)}`);
   server.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
      server.log.info('hello world');
      return { hello: 'world' };
   });
}