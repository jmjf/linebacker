import { fastify } from 'fastify';
import { routes } from './routes';

const server = fastify({
   logger: true
});

server.register(routes);

server.log.info('starting server on port 3000');
server.listen(3000, (err: Error | null) => {
   if (err) {
      server.log.error(err);
      process.exit(1);
   }
});