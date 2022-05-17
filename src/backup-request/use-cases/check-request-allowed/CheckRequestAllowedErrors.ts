import { BaseError } from '../../../common/core/BaseError';

export class NotInReceivedStatusError extends BaseError {
   constructor(message: string) {
      super(message);
   }
}