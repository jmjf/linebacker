import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { appState } from '../app-state/appState';
import { TypeormBackup } from './entity/TypeormBackup.entity';
import { TypeormBackupRequest } from './entity/TypeormBackupRequest.entity';
import { TypeormClientAuthorization } from './entity/TypeormClientAuthorization';

export const typeormDataSource = new DataSource({
	type: 'mssql',
	host: appState.mssql_host,
	port: appState.mssql_port,
	username: appState.mssql_user,
	password: appState.mssql_password,
	database: appState.mssql_dbName,
	schema: appState.mssql_schemaName, // may be undefined
	synchronize: false,
	logging: false,
	entities: [TypeormBackupRequest, TypeormBackup, TypeormClientAuthorization],
	migrations: [],
	subscribers: [],
	options: { encrypt: false },
});
