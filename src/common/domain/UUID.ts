import uuid from 'uuid';
import { ValueObject } from './ValueObject';

export interface UUIDProps {
   value?: string;
}

export class UUID extends ValueObject<UUIDProps> {

   public toString(): string {
      return this.props.value;
   }

   private constructor (props:UUIDProps) {
      super(props);
   }

   public static create (id: string): UUID {
      if (id === undefined || id === null || !uuid.validate(id) || uuid.version(id) !== 4) {
         throw new Error('UUID.create() | id string must be a valid UUID v4.');
      } 

      return new UUID({ value: id});
   }

   public equals(id?: UUID): boolean {
      if (id === null || id === undefined) {
         return false;
      }
      if (!(id instanceof this.constructor)) {
         return false;
      }

      return (id.toString() === this.props.value);
   }
}