import { nanoid } from 'nanoid';

export class UniqueIdentifier {
	private _value: string;
	public constructor(value?: string) {
		this._value = value ? value : nanoid();
	}

	public get value(): string {
		return this._value;
	}

	public equals(id?: UniqueIdentifier): boolean {
		if (id === null || id === undefined) {
			return false;
		}
		if (!(id instanceof this.constructor)) {
			return false;
		}

		return id.value === this._value;
	}
}
