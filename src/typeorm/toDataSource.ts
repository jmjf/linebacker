import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { BackupRequest } from './entity/BackupRequest.entity';

export const toDataSource = new DataSource({
	type: 'mssql',
	host: 'localhost',
	port: 1433,
	username: process.env.SQLSERVER_USER,
	password: process.env.SQLSERVER_PASSWORD,
	database: process.env.SQLSERVER_DB,
	schema: process.env.SQLSERVER_SCHEMA,
	synchronize: false,
	logging: false,
	entities: [BackupRequest],
	migrations: [],
	subscribers: [],
	options: { encrypt: false },
});
