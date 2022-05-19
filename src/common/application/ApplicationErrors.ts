import { BaseError } from '../core/BaseError';

export class UnexpectedError extends BaseError {
   constructor(message: string) {
      super(message);
   }
}