import { FastifyRequest, FastifyReply } from 'fastify';

const responseTypes = {
   json: 'application/json',
   text: 'text/plan'
};

export abstract class FastifyController {

   protected abstract execImpl(request: FastifyRequest, reply: FastifyReply): Promise<void | any>;

   public async execute(request: FastifyRequest, reply: FastifyReply): Promise<void | any> {
      try {
         await this.execImpl(request, reply);
      } catch (e) {
         console.log(e);
      }
   }

   public replyOk<T>(reply: FastifyReply, dto?: T) {
      reply.status(200);
      if (dto) {
         reply.type(responseTypes.json);
      }
   }

   public replyAccepted<T>(reply: FastifyReply, dto?: T) {
      reply.status(202);
      if (dto) {
         reply.type(responseTypes.json);
      }   
   }

   public replyBadRequest(reply: FastifyReply) {
      reply
         .status(400)
         .type(responseTypes.json);
   }

   public replyServerError(reply: FastifyReply) {
      reply
         .status(500)
         .type(responseTypes.json);
   }
}