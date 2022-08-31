import { UniqueIdentifier } from './UniqueIdentifier';

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
 * @param v - value to be tested (type any)
 * @returns boolean
 */
const isEntity = (v: unknown): v is Entity<unknown> => {
	return v instanceof Entity;
};

/**
 * Abstract class representing a domain driven design entity.
 *
 * @typeParam `T` type of the Entity's properties object (interface)
 */
export abstract class Entity<T> {
	protected readonly _id: UniqueIdentifier;
	public readonly props: T;

	/**
	 *
	 * @param props an object shaped like the entity's properties (<T>)
	 * @param id optional UniqueIdentifier, must be a valid UUIDv4 (not validated)
	 *
	 * @remarks If `id` isn't provided, the constructor will create a new UniqueIdentifier.
	 *
	 */
	constructor(props: T, id?: UniqueIdentifier) {
		this._id = id ? id : new UniqueIdentifier();
		this.props = props;
	}

	/**
	 *
	 * @param indent number of spaces to indent for pretty printed output; if not provided, don't pretty print (prefer for logging)
	 * @returns the entity's data as a JSON string with all values in one object (id and props values in the same object)
	 *
	 * @remarks the default Object.prototype.toString() method returns a JSON string like {_id, props: {...} }. This method flattens it.
	 */
	public toJSON(indent?: number): string {
		const props = JSON.parse(JSON.stringify(this.props));
		props.id = this._id.value;
		return JSON.stringify(props, null, indent);
	}

	/**
	 *
	 * @param object (optional) Entity of type T to test for equality to this entity
	 * @returns `boolean`
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

		return this._id.value === object._id.value;
	}
}
