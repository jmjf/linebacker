import { BaseError } from '../core/BaseError';

// this error is common to many things
export class PropsError extends BaseError {
   constructor(message: string) {
      super(message);
      this.name = 'PropsError';
   }
}