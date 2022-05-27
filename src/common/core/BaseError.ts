export abstract class BaseError extends Error {
   // inherited from Error
   //   message: string
   //   name: string
   //   stack: string
   public readonly callerMessage: string;
   public readonly callerLine: string;       // first line of the stack
   public readonly functionName: string;     // function name from first line of the stack
   public readonly fileName: string;         // filename from first line of the stack

   constructor(message?: string) {
      super(message);
      this.callerMessage = message || '';
      this.name = this.constructor.name;
      if (this.stack) {
         this.callerLine = this.stack.split('\n')[1].trim();
         this.functionName = this.callerLine.match(/at ([^ ]+)/)?.[1] || `can't parse function name`;
         const lastSlash = this.callerLine.lastIndexOf('/');
         this.fileName = this.callerLine.substring(lastSlash + 1, this.callerLine.indexOf('.', lastSlash));
      } else {
         this.callerLine = 'no stack';
         this.functionName = 'no stack';
         this.fileName = 'no stack';
      }
   }
}

