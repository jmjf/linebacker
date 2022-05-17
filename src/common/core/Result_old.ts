import { log } from '../adapter/logger';

/**
 * A class that represents an operation's outcome
 *
 * @typeparam `T` Type of the Result's value or error object (interface)
 * 
 * @property `isSuccess` true if the result is successful
 * @property `isFailure` true if the result is a failure
 * @property `error` the error object or message (T | string)
 *
 * @remarks
 * Also provides factory functions `succeed()` and `fail()` -- prefer over the raw constructor
 */
export class Result<T, E> {
	public isSuccess: boolean;
	public isFailure: boolean;
	public error: E | string;
	private _value: T;

	/**
	 *
	 * @param isSuccess identifies if the operation was successful
	 * @param error (optional) an error message or object returned by a failed operation
	 * @param value (optional) a value returned by an operation (successful or failed)
	 * 
	 * @remarks
	 * Favor using `succeed()` or `fail()` to create an appropriate result.
	 */
	public constructor(isSuccess: boolean, error?: E | string, value?: T) {
		if (isSuccess && error) {
			throw new Error(
				'InvalidOperation: A result cannot be successful and contain an error'
			);
		}
		if (!isSuccess && !error) {
			throw new Error(
				'InvalidOperation: A failing result needs to contain an error message'
			);
		}

		this.isSuccess = isSuccess;
		this.isFailure = !isSuccess;
		this.error = error as E;
		this._value = value as T;

		// do not allow any changes
		Object.freeze(this);
	}

	/**
	 *
	 * @returns the value of a successful result
	 * @error throws an `Error` if called for an error result
	 */
	public getValue(): T {
		if (!this.isSuccess) {
			log.error(` _time: '${(new Date()).toUTCString()}', error: '${JSON.stringify(this.error)}'}`);
			throw new Error(
				'Cannot get the value of an error result. Use errorValue instead.'
			);
		}

		return this._value;
	}

	/**
	 *
	 * @returns the value of an unsuccessful result cast as T 
	 * @remarks use for non-string errors
	 */
	public errorValue(): T {
		return this.error as T;
	}

	/**
	 * @remarks
	 * Prefer using `Result.succeed()` over the bare constructor
	 *
	 * @typeparam `U` type of the Result's value object (interface)
	 *
	 * @param value (optional) a value to use for the result
	 * @returns `Result<U, never>` a successful result
	 */
	public static succeed<U>(value?: U): Result<U, never> {
		return new Result<U, never>(true, null, value);
	}

	/**
	 * @remarks
	 * Prefer using `Result.fail()` over the bare constructor
	 *
	 * @typeparam `U` type of the Result's error object (interface) [check this]
	 *
	 * @param error a string representing the error message
	 * @returns `Result<never, U>` a failure result
	 */
		public static fail<U>(error: any): Result<never, U> {
		return new Result<never, U>(false, error);
	}

	/**
	 *
	 * @param results - a list of results to summarize
	 * @returns `Result<any>` - the net outcome of the list of results
	 *
	 * @remarks
	 * If any result fails, returns that result.
	 * If no result fails, returns `Result.succeed()` with no value.
	 */
	public static combine(results: Result<any, any>[]): Result<any, any> {
		for (const result of results) {
			if (result.isFailure) return result;
		}
		return Result.succeed();
	}
}