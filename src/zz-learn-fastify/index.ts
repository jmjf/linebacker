import { FastifyRequest, FastifyReply, fastify } from 'fastify';

const server = fastify({
   logger: true
});

server.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
   server.log.info('hello world');
   return { hello: 'world' };
});

const start = async() => {
   try {
      server.log.info('starting server on port 3000');
      await server.listen(3000);
   } catch (err) {
      server.log.error(err);
      process.exit(1);
   }
};

start();