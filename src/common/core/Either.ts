/**
 * A union type that represents a value with two possibilities.
 * 
 * @typeparam `LeftType` type for the value of the Left side of Either
 * @typeparam `RightType` type for the value of the right side of Either
 * 
 * @remarks Either is derived from functional languages like Haskell. It's commonly used to represent a value
 * that may be either correct or an error. By convention, Left is the error and Right is the correct value.
 * Remember that Right is right (correct).
 * 
 * To use, construct an Either by calling the left() or right() factory functions provided below.
 */
 export type Either<LeftType, RightType> = Left<LeftType, RightType> | Right<LeftType, RightType>;

 /**
  * A class that represents the left side value of an Either
  */
 export class Left<LeftType, RightType> {
    readonly value: LeftType;
 
    constructor(value: LeftType) {
       this.value = value;
    }
 
    isLeft(): this is Left<LeftType, RightType> {
       return true;
    }
 
    isRight(): this is Right<LeftType, RightType> {
       return false;
    }
 }
 
 /**
  * A class that represents the left side value of an Either
  */
 export class Right<LeftType, RightType> {
    readonly value: RightType;
 
    constructor(value: RightType) {
       this.value = value;
    }
 
    isLeft(): this is Left<LeftType, RightType> {
       return false;
    }
 
    isRight(): this is Right<LeftType, RightType> {
       return true;
    }
 }
 
 /**
  * A factory function that returns a Left side Either.
  * 
  * @param l the value of the Left returned
  * 
  * @typeParam `LeftType` the type of the left
  * 
  * @returns `Either<LeftType, RightType>` that is a Left
  * 
  * @example
  * ```
  * if (error) {
  * 	return left(Result.fail<BackupRequest>(error)) as Response;
  * }
  * ```
  */
 export const left = <LeftType, RightType>(l: LeftType): Either<LeftType, RightType> => {
    return new Left(l);
 };
 
 /**
  * A factory function that returns a Right side Either.
  * 
  * @param r the value of the Right returned
  * 
  * @typeParam `RightType` the type of a the right
  * 
  * @returns `Either<LeftType, RightType>` that is a Right
  * 
  * @example `return right(Result.ok(<void>));`
  */
 export const right = <LeftType, RightType>(r: RightType): Either<LeftType, RightType> => {
    return new Right<LeftType, RightType>(r);
 };