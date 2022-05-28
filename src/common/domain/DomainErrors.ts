import { BaseError } from '../core/BaseError';

// this error is common to many things
export class PropsError extends BaseError {
   constructor(message: string) {
      super(message);
      this.name = 'PropsError';
      this.code = 'BadData';     // code goes back to the caller; change to avoid a whiff of an information leak
   }
}