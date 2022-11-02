interface IResult<OkType, ErrType> {
	/**
	 * Is the `Result` an `Ok`?
	 *
	 * @returns `true` if the `Result` is an `Ok`; `false` if the `Result` is an `Err`
	 *
	 * @example `if (result.isOk()) { console.log(result.value); }`
	 */
	isOk(): this is Ok<OkType, ErrType>;

	/**
	 * Is the `Result` an `Err`?
	 *
	 * @returns `true` if the `Result` is an `Err`; `false` if the `Result` is an `Ok`
	 *
	 * @example `if (result.isErr()) { console.log(result.error); }`
	 */
	isErr(): this is Err<OkType, ErrType>;

	/**
	 * Return the value (if `Ok`) or a default value (if `Err`)
	 *
	 * @param v: default value to return if `Err`
	 *
	 * @returns the value if the `Result` is an `Ok`; the default value if the `Result` is an `Err`
	 *
	 * Rust `unwrap_or_default` requires the default to be a type that implements the `Default` trait, so `unwrap_or` instead.
	 * `if (result.isOk()) { ... result.value ...}` works, is often clearer, and is symmetric with error access.
	 */
	unwrapOr<DefaultType>(v: DefaultType): OkType | DefaultType;

	// Rust unwrap_err returns the error or panics (throws an uncaught error), so defeats the purpose here.
	// Use `if (result.isErr()) { ... result.error ... };` to access error
}

export class Ok<OkType, ErrType> implements IResult<OkType, ErrType> {
	constructor(readonly value: OkType) {
		// readonly value makes it a class property, no need to explictly assign
	}

	isOk(): this is Ok<OkType, ErrType> {
		return true;
	}

	isErr(): this is Err<OkType, ErrType> {
		return false;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	unwrapOr<DefaultType>(v: DefaultType): OkType | DefaultType {
		return this.value;
	}
}

export class Err<OkType, ErrType> implements IResult<OkType, ErrType> {
	constructor(readonly error: ErrType) {
		// readonly error makes it a class property, no need to explictly assign
	}

	isOk(): this is Ok<OkType, ErrType> {
		return false;
	}

	isErr(): this is Err<OkType, ErrType> {
		return true;
	}

	unwrapOr<DefaultType>(v: DefaultType): OkType | DefaultType {
		return v;
	}
}

export type Result<OkType, ErrType> = Ok<OkType, ErrType> | Err<OkType, ErrType>;

export const ok = <OkType, ErrType = never>(value: OkType): Ok<OkType, ErrType> => new Ok(value);

export const err = <OkType = never, ErrType = unknown>(error: ErrType): Err<OkType, ErrType> => new Err(error);
