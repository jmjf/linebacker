import { BaseError } from '../core/BaseError';

// this error is common to many things
export class InvalidPropsError extends BaseError {
   constructor(message: string) {
      super(message);
   }
}