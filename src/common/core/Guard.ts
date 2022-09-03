import { err, ok, Result } from './Result';

/**
 * Result returned by a guard
 */
export interface IGuardError {
	argName: string;
	message: string;
}

/**
 * Individual argument passed to a guard
 */
export interface IGuardArgument {
	arg: unknown;
	argName: string;
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
	 * @returns `IGuardError` If `arg` is not null or undefined, `isSuccess` is true.
	 * If `arg` is null or undefined, `isSuccess` is false and `message`reports the failing `argName`.
	 *
	 */
	public static againstNullOrUndefined(arg: unknown, argName: string): Result<null, IGuardError> {
		if (arg === null || arg === undefined) {
			return err({ argName, message: `${argName} is null or undefined` });
		} else {
			return ok(null);
		}
	}

	/**
	 * Guards to ensure none of the values passed is NOT null or undefined ("against" means not null or undefined === true)
	 *
	 * @param args an array of values and names to check for null or undefined
	 * @returns `IGuardError` If all members of `args` are not null or undefined, `isSuccess` is true.
	 * If any member of `args` is null or undefined, `isSuccess` is false and `message` reports the failing `argName`.
	 *
	 */
	public static againstNullOrUndefinedBulk(args: GuardArgumentCollection): Result<null, IGuardError> {
		for (const arg of args) {
			const result = this.againstNullOrUndefined(arg.arg, arg.argName);
			if (result.isErr()) return result;
		}

		return ok(null);
	}

	/**
	 * Guards to ensure the argument is in a list of valid values ("is" means is in list -> true)
	 *
	 * @param arg the argument to confirm is in the list of valid values
	 * @param validValues an array of valid values
	 * @param argName name of the argument (variable) for error reporting
	 * @returns `IGuardError` If `arg` is in `validValues`, `isSuccess` is true.
	 * If `arg` is not in `validValues`, `isSuccess` is false and `message` reports the failing `argName` and `arg`.
	 *
	 * @remarks
	 * Use this guard for simple type comparisons (string, number, etc.). The check uses `Array.includes()`, so may not work for objects or classes.
	 *
	 */
	public static isOneOf(arg: unknown, validValues: unknown[], argName: string): Result<null, IGuardError> {
		if (validValues.includes(arg)) {
			return ok(null);
		} else {
			return err({ argName, message: `is not one of ${JSON.stringify(validValues)} ; ${argName} |${arg}|` });
		}
	}

	/**
	 * Guards to ensure the argument passed is a valid Date or can be converted to a valid Date
	 *
	 * @param arg the argument to confirm as a valid Date
	 * @param argName name of the argument (variable) for error reporting
	 * @returns `IGuardError` If `arg` is a valid Date or can be converted to one, `isSuccess` is true.
	 * If `arg` is not a valid Date and can't be converted to one, `isSuccess` is false and `message` reports the failing `argName` and `arg`.
	 *
	 */
	public static isValidDate(arg: unknown, argName: string): Result<null, IGuardError> {
		if (arg instanceof Date && !isNaN(arg as unknown as number)) {
			return ok(null);
		}

		if (!isNaN(Date.parse(arg as string))) {
			return ok(null);
		}

		return err({
			argName,
			message: `not a valid date ; ${argName} |${arg instanceof Object ? JSON.stringify(arg) : arg}|`,
		});
	}
}
