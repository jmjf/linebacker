import { BaseError } from '../../../common/core/BaseError';

export class NotInAllowedStatusError extends BaseError {
   constructor(message: string) {
      super(message);
   }
}

export class SendToInterfaceFailedError extends BaseError {
   constructor(message: string) {
      super(message);
   }
}