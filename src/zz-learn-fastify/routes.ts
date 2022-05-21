import { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';

export async function routes(server: FastifyInstance, options: FastifyPluginOptions) {
   server.log.info(`called routes with options ${JSON.stringify(options)}`);

   server.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
      server.log.info('hello world');
      return { hello: 'world' };
   });

   server.get('/square/:x', async (request: FastifyRequest, reply: FastifyReply) => {
      // params is type unknown, which makes sense, so declare local type and use it
      type ParamsType = {
         x: number
      };

      const x = (<ParamsType>request.params).x;

      server.log.info(`square called with ${x}`);

      return { param: x, square: x*x };
   });
}