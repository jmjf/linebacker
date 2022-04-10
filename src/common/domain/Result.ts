/**
 * A class that represents an operation's outcome
 *
 * @typeparam T - Type of the Result's value or error object (interface)
 *
 * @remarks
 * Also provides factory functions to support working with Results
 */
export class Result<T> {
	public isSuccess: boolean;
	public isFailure: boolean;
	public error: T | string;
	private _value: T;

	/**
	 *
	 * @param {boolean} isSuccess - identifies if the operation was successful
	 * @param {T | string} error - optional, an error message or object returned by a failed operation
	 * @param {T} value - optional, a value returned by an operation (successful or failed)
	 */
	public constructor(isSuccess: boolean, error?: T | string | null, value?: T) {
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
		this.error = error as T;
		this._value = value as T;

		// do not allow any changes
		Object.freeze(this);
	}

	/**
	 *
	 * @returns {T} - the value of a successful operation
	 */
	public getValue(): T {
		if (!this.isSuccess) {
			console.log(this.error);
			throw new Error(
				'Cannot get the value of an error result. Use `errorValue` instead.'
			);
		}

		return this._value;
	}

	/**
	 *
	 * @returns {T} - the value of an unsuccessful operation
	 */
	public errorValue(): T {
		return this.error as T;
	}

	/**
	 * @remarks
	 * Prefer using `Result.ok()` over the bare constructor
	 *
	 * @typeparam U - Type of the Result's value object (interface)
	 *
	 * @param {U} value - optional, a value to use for the result
	 * @returns {Result<U>} - a successful result
	 */
	public static ok<U>(value?: U): Result<U> {
		return new Result<U>(true, null, value);
	}

	/**
	 * @remarks
	 * Prefer using `Result.fail()` over the bare constructor
	 *
	 * @typeparam U - Type of the Result's error object (interface) [check this]
	 *
	 * @param {U} error - a string representing the error message
	 * @returns {Result<U>} - a failure result
	 */
	public static fail<U>(error: string): Result<U> {
		return new Result<U>(false, error);
	}

	/**
	 *
	 * @param {Result<any>[]} results - a list of results to summarize
	 * @returns {Result<any>} - the net outcome of the list of results
	 *
	 * @remarks
	 * If any result fails, `Result.combine()` returns that result
	 * If no result fails, `Result.combine()` returns Result.ok()
	 */
	public static combine(results: Result<any>[]): Result<any> {
		for (const result of results) {
			if (result.isFailure) return result;
		}
		return Result.ok();
	}
}