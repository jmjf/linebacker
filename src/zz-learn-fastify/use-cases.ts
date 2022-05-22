import { err, ok, Result } from '../common/core/Result';
import { UseCase } from '../common/application/UseCase';

export interface IHelloWorldResponse {
   hello: string
};

type HelloWorldResponse = Result<IHelloWorldResponse, Error>;

export class HelloWorldUseCase implements UseCase<void, Promise<HelloWorldResponse>> {
   async execute(request: void): Promise<HelloWorldResponse> {
      return Promise.resolve(ok({ hello: 'world' } as IHelloWorldResponse));
   }
};

export interface ISquareResponse {
   param: number,
   square: number
};

export interface ISquareDTO {
   x: number
}

type SquareResponse = Result<ISquareResponse, Error>;

export class SquareUseCase implements UseCase<ISquareDTO, Promise<SquareResponse>> {
   async execute(request: ISquareDTO): Promise<SquareResponse> {
      let x: number;

      if (typeof request.x === 'string' && !isNaN(parseInt(request.x))) {
         x = parseInt(request.x);
         return Promise.resolve(ok({param: x, square: x * x }));
      }
      if (typeof request.x === 'number') {
         x = request.x;
         return Promise.resolve(ok({param: x, square: x * x }));
      }

      return Promise.resolve(err(new TypeError(`'${request.x}' is not a number`)));
   }
}

