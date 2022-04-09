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
	public constructor(isSuccess: boolean, error?: T | string, value?: T) {
		if (isSuccess && error) {
			throw new Error("InvalidOperation: A result cannot be successful and contain an error");
		}
		if (!isSuccess && !error) {
			throw new Error("InvalidOperation: A failing result needs to contain an error message");
		}

		this.isSuccess = isSuccess;
		this.isFailure = !isSuccess;
		this.error = error;
		this._value = value;

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
			throw new Error("Can't get the value of an error result. Use 'errorValue' instead.");
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
	 * Generally, prefer using `Result.ok()` over the bare constructor
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
	 * Generally, prefer using `Result.fail()` over the bare constructor
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
		for (let result of results) {
			if (result.isFailure) return result;
		}
		return Result.ok();
	}
}

// I'm keeping these for now, but need to figure out what they're really doing.

export type Either<L, A> = Left<L, A> | Right<L, A>;

export class Left<L, A> {
	readonly value: L;

	constructor(value: L) {
		this.value = value;
	}

	isLeft(): this is Left<L, A> {
		return true;
	}

	isRight(): this is Right<L, A> {
		return false;
	}
}

export class Right<L, A> {
	readonly value: A;

	constructor(value: A) {
		this.value = value;
	}

	isLeft(): this is Left<L, A> {
		return false;
	}

	isRight(): this is Right<L, A> {
		return true;
	}
}

export const left = <L, A>(l: L): Either<L, A> => {
	return new Left(l);
};

export const right = <L, A>(a: A): Either<L, A> => {
	return new Right<L, A>(a);
};
