import { Column, Entity } from 'typeorm';

@Entity({ name: 'ClientAuthorization' })
export class TypeormClientAuthorization {
	@Column({
		name: 'ClientIdentifier',
		type: 'varchar',
		length: 256,
		primary: true,
		unique: true,
		nullable: false,
	})
	clientIdentifier: string;

	@Column({
		name: 'ClientScopes',
		type: 'varchar',
		length: 1024,
		nullable: false,
	})
	clientScopes: string;
}
