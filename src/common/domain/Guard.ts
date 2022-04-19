/**
 * Result returned by a guard
 */
export interface IGuardResult {
   isSuccess: boolean;
   message?: string;
}

/**
 * Individual argument passed to a guard
 */
export interface IGuardArgument {
   arg: any,
   argName: string
}

/**
 * Compound argument passed to a guard.
 */
export type GuardArgumentCollection = IGuardArgument[];

/**
 * Class providing methods for standard argument checks
 *
 */

export class Guard {
   
   /**
    * Guards to ensure the passed value is NOT null or undefined ("against" means not null or undefined -> true)
    * 
    * @param arg value to check for null or undefined
    * @param argName name of the value (variable) for error reporting
    * @returns `IGuardResult` If `arg` is not null or undefined, `isSuccess` is true.
    * If `arg` is null or undefined, `isSuccess` is false and `message`reports the failing `argName`.
    * 
    */
   public static againstNullOrUndefined (arg: any, argName: string): IGuardResult {
      if (arg === null || arg === undefined) {
         return { isSuccess: false, message: `${argName} is null or undefined` };
      } else {
         return { isSuccess: true };
      }
   }

   /**
    * Guards to ensure none of the values passed is NOT null or undefined ("against" means not null or undefined === true)
    *
    * @param args an array of values and names to check for null or undefined
    * @returns `IGuardResult` If all members of `args` are not null or undefined, `isSuccess` is true. 
    * If any member of `args` is null or undefined, `isSuccess` is false and `message` reports the failing `argName`.
    * 
    */
   public static againstNullOrUndefinedBulk (args: GuardArgumentCollection): IGuardResult {
      for (const arg of args) {
         const result = this.againstNullOrUndefined(arg.arg, arg.argName);
         if (!result.isSuccess) return result;
      }

      return { isSuccess: true };
   }

   /**
    * Guards to ensure the argument is in a list of valid values ("is" means is in list -> true)
    * 
    * @param arg the argument to confirm is in the list of valid values
    * @param validValues an array of valid values
    * @param argName name of the argument (variable) for error reporting
    * @returns `IGuardResult` If `arg` is in `validValues`, `isSuccess` is true.
    * If `arg` is not in `validValues`, `isSuccess` is false and `message` reports the failing `argName` and `arg`.
    * 
    * @remarks
    * Use this guard for simple type comparisons (string, number, etc.). The check uses `Array.includes()`, so may not work for objects or classes.
    * 
    */
   public static isOneOf (arg: any, validValues: any[], argName: string): IGuardResult {
      if (validValues.includes(arg)) {
         return { isSuccess: true };
      } else {
         return { isSuccess: false, message: `${argName} is not one of ${JSON.stringify(validValues)}. Got |${arg}|`};
      } 
   }

   /**
    * Guards to ensure the argument passed is a valid Date or can be converted to a valid Date
    * 
    * @param arg the argument to confirm as a valid Date
    * @param argName name of the argument (variable) for error reporting
    * @returns `IGuardResult` If `arg` is a valid Date or can be converted to one, `isSuccess` is true.
    * If `arg` is not a valid Date and can't be converted to one, `isSuccess` is false and `message` reports the failing `argName` and `arg`.
    * 
    */
   public static isValidDate(arg: any, argName: string): IGuardResult {
      if (arg instanceof Date && !isNaN(arg as unknown as number)) {
         return { isSuccess: true };
      }

      if (!isNaN(Date.parse(arg))) {
         return { isSuccess: true };
      }

      return { isSuccess: false, message: `${argName} is not a valid date. Got |${(arg instanceof Object) ? JSON.stringify(arg) : arg}|` };
   }
}
