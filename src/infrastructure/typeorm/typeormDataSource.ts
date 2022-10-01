import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { TypeormBackup } from './entity/TypeormBackup.entity';
import { TypeormBackupRequest } from './entity/TypeormBackupRequest.entity';
import { TypeormClientAuthorization } from './entity/TypeormClientAuthorization';

export const typeormDataSource = new DataSource({
	type: 'mssql',
	host: process.env.SQLSERVER_URL,
	port: Number.parseInt(process.env.SQLSERVER_PORT || '1433'),
	username: process.env.SQLSERVER_USER,
	password: process.env.SQLSERVER_PASSWORD,
	database: process.env.SQLSERVER_DB,
	schema: process.env.SQLSERVER_SCHEMA,
	synchronize: false,
	logging: false,
	entities: [TypeormBackupRequest, TypeormBackup, TypeormClientAuthorization],
	migrations: [],
	subscribers: [],
	options: { encrypt: false },
});
