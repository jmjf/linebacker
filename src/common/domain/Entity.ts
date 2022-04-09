import uuid from "uuid";

/**
 * Type guard for the Entity class
 *
 * @remarks
 * See https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates
 *
 * The `v is Entity<any>` type predicate return type makes `isEntity` act as a type guard.
 *
 * After calling isEntity(), TypeScript narrows the type of the passed parameter based on
 * the return value. In the true branch, it is an Entity and can be referecned as one.
 *
 * In the TS docs example, the type is either a Fish or a Bird, so if it isn't a Fish, TS
 * knows it must be a Bird.
 *
 * @param {any} v - value to be tested
 * @returns {boolean}
 */
const isEntity = (v: any): v is Entity<any> => {
	return v instanceof Entity;
};

/**
 * Abstract class representing a domain driven design entity.
 *
 * @typeParam T - type of the Entity's properties object (interface)
 */
export abstract class Entity<T> {
	protected readonly _id: string;
	public readonly props: T;

	/**
	 *
	 * @param {T} props - an object shaped like the entity's properties
	 * @param {string} id - optional, must be a valid uuid (not validated)
	 *
	 * @remarks if id isn't provided, will generate a uuid
	 */
	constructor(props: T, id?: string) {
		this._id = id ? id : uuid.v4();
		this.props = props;
	}

	/**
	 *
	 * @param {Entity<T>} object - optional, object to test for equality to this
	 * @returns {boolean}
	 */
	public equals(object?: Entity<T>): boolean {
		if (object == null || object == undefined) {
			return false;
		}

		if (this === object) {
			return true;
		}

		if (!isEntity(object)) {
			return false;
		}

		return this._id === object._id;
	}
}
