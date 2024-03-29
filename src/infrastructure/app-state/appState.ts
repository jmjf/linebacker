import dotenv from 'dotenv';
import path from 'node:path';

import { logger } from '../logging/pinoLogger';

import { isTest } from '../../common/utils/utils';

// import { Logger } from 'pino';
// // cannot use logger because it requires appState to be valid

const moduleName = path.basename(module.filename);

const envAsNumOrDefault = (u: unknown, def: number) => {
	if (typeof u === 'string') return !isNaN(parseInt(u)) ? parseInt(u) : def;
	if (typeof u === 'number') return u as number;
	return def;
};

const strToArray = (str: string | undefined, delimiter: string) => {
	if (typeof str !== 'string' || str.length === 0) return [];

	return typeof str === 'string' && str.includes(delimiter) ? str.split(delimiter) : [str];
};

const strToBmqRemoveOn = (str: string | undefined) => {
	if (typeof str === 'string') {
		if (str.toLowerCase() === 'true') return true;

		if (str[0] === '{') return JSON.parse(str);

		if (!isNaN(parseInt(str))) return parseInt(str);
	}
	return undefined;
};

const appEnv = process.env.APP_ENV;
if (!appEnv) {
	// fake a log message because we can't call pinoLogger (I think)
	logger.error(
		{
			moduleName,
			functionName: 'pre-start',
		},
		`APP_ENV is not set; can't load environment`
	);
} else {
	dotenv.config({ path: `./env/${appEnv}.env` });
}

const linebackerApiPort = envAsNumOrDefault(process.env.LINEBACKER_API_PORT, 3000);

export const appState = {
	pm2_processId: process.env.pm_id || null,
	pm2_instanceId: process.env.PM2_INSTANCE_ID || null,

	// logger must define log level before appState is ready, so default there and use logger value here
	logger_logLevel: isTest() ? 'fatal' : process.env.LOG_LEVEL || 'info',

	linebackerApi_port: linebackerApiPort,

	brQueueWatcher_port: envAsNumOrDefault(process.env.BRQW_ZPAGES_PORT, linebackerApiPort + 1),
	brQueueWatcher_startDelayMs: envAsNumOrDefault(process.env.BRQW_START_WATCH_DELAY, 5000),

	postgres_host: process.env.POSTGRES_HOST || '',
	postgres_port: envAsNumOrDefault(process.env.POSTGRES_PORT, 5432),
	postgres_user: process.env.POSTGRES_USER || '',
	postgres_password: process.env.POSTGRES_PASSWORD || '',
	postgres_dbName: process.env.POSTGRES_DB || '',

	mssql_host: process.env.SQLSERVER_HOST || '',
	mssql_port: envAsNumOrDefault(process.env.SQLSERVER_PORT, 1433),
	mssql_user: process.env.SQLSERVER_USER || '',
	mssql_password: process.env.SQLSERVER_PASSWORD || '',
	mssql_dbName: process.env.SQLSERVER_DB || '',
	mssql_schemaName: process.env.SQLSERVER_SCHEMA || '',

	auth_issuers: strToArray(process.env.AUTH_ISSUERS, '|'),
	auth_audience: process.env.AUTH_AUDIENCE || '',
	auth_kid: process.env.AUTH_KID || '',

	azureQueue_connectTimeoutMs: envAsNumOrDefault(process.env.AZUREQUEUE_CONNECT_TIMEOUT_MS, 15000),
	azureQueue_visibilityTimeoutSec: envAsNumOrDefault(process.env.AZUREQUEUE_VISIBILITY_TIMEOUT_SEC, 15000),
	azureQueue_authMethod: process.env.AZUREQUEUE_AUTH_METHOD || '',
	azureQueue_queueAccountUri: process.env.AZUREQUEUE_QUEUE_ACCOUNT_URI || '',
	// for storage account shared key credential
	azureQueue_saskAccountName: process.env.AZUREQUEUE_SASK_ACCOUNT_NAME || '',
	azureQueue_saskAccountKey: process.env.AZUREQUEUE_SASK_ACCOUNT_KEY || '',
	// for app registration client secret credential
	azureQueue_arcsTenantId: process.env.AZUREQUEUE_ARCS_TENANT_ID || '',
	azureQueue_arcsClientId: process.env.AZUREQUEUE_ARCS_CLIENT_ID || '',
	azureQueue_arcsClientSecret: process.env.AZUREQUEUE_ARCS_CLIENT_SECRET || '',

	splunk_host: process.env.SPLUNK_HOST || '',
	splunk_port: envAsNumOrDefault(process.env.SPLUNK_HEC_PORT, 8078),
	splunk_token: process.env.SPLUNK_HEC_TOKEN || '',

	eventBus_type: process.env.EVENTBUS_TYPE || 'memory',
	eventBus_bmqRetryDelayStartMs: envAsNumOrDefault(process.env.EVENTBUS_BMQ_RETRY_DELAY_START_MS, 1000),
	eventBus_bmqRetryDelayMaxMs: envAsNumOrDefault(process.env.EVENTBUS_BMQ_RETRY_DELAY_MAX_MS, 60000),
	eventBus_bmqRemoveOnFail: strToBmqRemoveOn(process.env.EVENTBUS_BMQ_REMOVE_ON_FAIL),
	eventBus_bmqRemoveOnComplete: strToBmqRemoveOn(process.env.EVENTBUS_BMQ_REMOVE_ON_COMPLETE),

	bullmq_redisHost: process.env.BULLMQ_REDIS_HOST || '',
	bullmq_redisPort: envAsNumOrDefault(process.env.BULLMQ_REDIS_PORT, 6379),

	/** Not supported yet
	 *
	 * # Prisma
	 * DATABASE_URL_SQLITE="file:./dev.db"
	 * DATABASE_URL_PG="postgresql://linebacker:pgpass@localhost:5432/linebacker"
	 *
	 */
};

// set initial log level, now that we know it
logger.level = appState.logger_logLevel;

export function isAppStateUsable(requiredMembers: string[]): boolean {
	const logContext = { moduleName, functionName: 'isAppStateUseable' };

	const missingNames = getMissingAppStateMembers(requiredMembers);

	if (missingNames.length > 0) {
		logger.error({ ...logContext, missingNames }, 'Missing required state values');
		return false;
	}

	return true;
}

export function getMissingAppStateMembers(requiredMembers: string[]): string[] {
	return requiredMembers.filter((envName) => {
		const envValue = (appState as Record<string, unknown>)[envName];
		// filter for undefined, null, '', [], isNaN
		return (
			typeof envValue === 'undefined' ||
			envValue === null ||
			(typeof envValue === 'string' && envValue === '') ||
			(Array.isArray(envValue) && envValue.length === 0) ||
			(typeof envValue !== 'undefined' &&
				typeof envValue !== 'string' &&
				!Array.isArray(envValue) &&
				isNaN(envValue as number))
		);
	});
}
