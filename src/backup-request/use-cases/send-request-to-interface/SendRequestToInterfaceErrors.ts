import { BaseError } from '../../../common/core/BaseError';

export class SendToInterfaceError extends BaseError {
   constructor(message: string) {
      super(message);
      this.name = 'SendToInterfaceError';
   }
}