import path from 'node:path';

import { appState, isAppStateUsable } from './infrastructure/app-state/appState';
import { logger } from './infrastructure/logging/pinoLogger';
import { typeormDataSource } from './infrastructure/typeorm/typeormDataSource';
import { typeormCtx } from './infrastructure/typeorm/typeormContext';
import { buildCircuitBreakers } from './infrastructure/typeorm/buildCircuitBreakers.typeorm';

import { delay } from './common/utils/utils';

import { buildApp } from './rcvAppExpTypeorm';

import { shutdown } from './shutdown';

const moduleName = path.basename(module.filename);
const serviceName = 'queue-watcher';
const featureName = 'store';

const startServer = async () => {
	const logContext = { moduleName, functionName: 'startServer' };

	logger.setBindings({
		serviceName,
		featureName,
		pm2ProcessId: appState.pm2_processId,
		pm2InstanceId: appState.pm2_instanceId,
	});

	const requiredStateMembers = [
		'brQueueWatcher_port',
		'mssql_host',
		'mssql_port',
		'mssql_user',
		'mssql_password',
		'mssql_dbName',
		'auth_issuers',
		'auth_audience',
		'auth_kid',
		'azureQueue_authMethod',
		'azureQueue_queueAccountUri',
		'eventBus_type',
	];

	if (
		!isAppStateUsable(requiredStateMembers) ||
		// sask additional
		(appState.azureQueue_authMethod.toLowerCase() === 'sask' &&
			!isAppStateUsable(['azureQueue_saskAccountName', 'azureQueue_saskAccountKey'])) ||
		// app registration additional
		(appState.azureQueue_authMethod.toLowerCase() === 'adcc' &&
			!isAppStateUsable(['azureQueue_tenantId', 'azureQueue_clientId', 'azureQueue_clientSecret']))
	) {
		logger.fatal(logContext, 'Required environment variables missing or invalid');
		process.exit(1);
	}

	logger.info(logContext, 'initializing TypeORM data source');
	await typeormDataSource.initialize();

	logger.info(logContext, 'configuring circuit breakers');
	const appAbortController = new AbortController();
	const circuitBreakers = buildCircuitBreakers(appAbortController.signal);

	logger.info(logContext, 'building server');
	const zpageDependencies = {
		readyzDependencies: [
			{
				depName: circuitBreakers.dbCircuitBreaker.serviceName,
				checkDep: circuitBreakers.dbCircuitBreaker.isConnected.bind(circuitBreakers.dbCircuitBreaker),
			},
		],
		healthzDependencies: Object.values(circuitBreakers).map((cb) => {
			return { depName: cb.serviceName, checkDep: cb.getStatusSync.bind(cb) };
		}),
	};
	const app = buildApp(logger, typeormCtx, circuitBreakers, zpageDependencies, appAbortController.signal);
	app.disable('x-powered-by');

	logger.info(logContext, 'starting server');
	try {
		const server = app.listen({ port: appState.brQueueWatcher_port });
		logger.info(logContext, `Server is running on port ${appState.brQueueWatcher_port}`);

		server.on('SIGINT', async () => {
			await shutdown(appAbortController, server, typeormDataSource);
		});
		server.on('message', async (msg: string) => {
			if (msg === 'shutdown') await shutdown(appAbortController, server, typeormDataSource);
		});
		if (process.send) process.send('ready');
	} catch (err) {
		logger.error(logContext, `${err}`);
		appAbortController.abort();
		await delay(5000);
		process.exit(1);
	}
};

startServer();
