import { BaseError } from '../core/BaseError';

export class DatabaseError extends BaseError {
   constructor(message: string) {
      super(message);
      this.name = 'DatabaseError';
   }
};

export class NotFoundError extends BaseError {
   constructor(message: string) {
      super(message);
      this.name = 'NotFoundError';
   }  
}

export class BackupJobServiceError extends BaseError {
   constructor(message: string) {
      super(message);
      this.name = 'BackupJobServiceError';
   }
};

export class InvalidApiVersionError extends BaseError {
   constructor(message: string) {
      super(message);
      this.name = 'InvalidApiVersionError';
   }  
}