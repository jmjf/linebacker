import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { TypeormBackupRequest } from './entity/TypeormBackupRequest.entity';

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
	entities: [TypeormBackupRequest],
	migrations: [],
	subscribers: [],
	options: { encrypt: false },
});
