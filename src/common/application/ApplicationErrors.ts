import { BaseError } from '../core/BaseError';

export class UnexpectedError extends BaseError {
   constructor(message: string) {
      super(message);
      this.name = 'UnexpectedError';
   }
}

export class BackupRequestStatusError extends BaseError {
   constructor(message: string) {
      super(message);
      this.name = 'BackupRequestStatusError';
   }
}