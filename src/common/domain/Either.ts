/**
 * A union type that represents a value with two possibilities.
 * 
 * @typeparam `L` type for the value of the Left side of Either
 * @typeparam `A` type for the value of the right side of Either
 * 
 * @remarks Either is derived from functional languages like Haskell. It's commonly used to represent a value
 * that may be either correct or an error. By convention, Left is the error and Right is the correct value.
 * Remember that Right is right (correct).
 * 
 * To use, construct an Either by calling the left() or right() factory functions provided below.
 */
 export type Either<L, A> = Left<L, A> | Right<L, A>;

 /**
  * A class that represents the left side value of an Either
  */
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
 
 /**
  * A class that represents the left side value of an Either
  */
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
 
 /**
  * A factory function that returns a Left side Either.
  * 
  * @param l the value of the Left returned
  * 
  * @typeParam `L` the type of l (the left)
  * 
  * @returns `Either<L, A>` that is a Left
  * 
  * @example
  * ```
  * if (error) {
  * 	return left(Result.fail<BackupRequest>(error)) as Response;
  * }
  * ```
  */
 export const left = <L, A>(l: L): Either<L, A> => {
    return new Left(l);
 };
 
 /**
  * A factory function that returns a Right side Either.
  * 
  * @param a the value of the Right returned
  * 
  * @typeParam `A` the type of a (the right)
  * 
  * @returns `Either<L, A>` that is a Right
  * 
  * @example `return right(Result.ok(<void>));`
  */
 export const right = <L, A>(a: A): Either<L, A> => {
    return new Right<L, A>(a);
 };