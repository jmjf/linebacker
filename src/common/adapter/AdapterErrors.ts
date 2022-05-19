import { BaseError } from '../core/BaseError';

export class DatabaseError extends BaseError {
   constructor(message: string) {
      super(message);
      this.name = 'DatabaseError';
   }
}