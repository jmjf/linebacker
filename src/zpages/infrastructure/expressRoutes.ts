import path from 'path';
import pm2 from 'pm2';
import tx2 from 'tx2';
import { Request, Response, Router } from 'express';
import { getRequestStats } from '.';
import { logger } from '../../infrastructure/logging/pinoLogger';

const moduleName = path.basename(module.filename);

// To promisify pm2 functions, we need a custom promisifiy function because pm2 needs 'this'
// eslint-disable-next-line @typescript-eslint/ban-types
function promisifyPm2(f: Function) {
	return (...args: unknown[]) => {
		// return a wrapper-function (*)
		return new Promise((resolve, reject) => {
			function callback(err: Error, result: unknown) {
				// our custom callback for f (**)
				if (err) {
					reject(err);
				} else {
					resolve(result);
				}
			}

			args.push(callback); // append our custom callback to the end of f arguments

			f.call(pm2, ...args); // call the original function
		});
	};
}

const pm2Connect = promisifyPm2(pm2.connect);
const pm2List = promisifyPm2(pm2.list);

interface Pm2TriggerResult {
	process: {
		pm_id: number;
		name: string;
		namespace: string;
		rev?: string;
		versioning?: {
			revision: string;
		};
	};
	at: number;
	data: any;
}

const pm2Trigger = (
	pm_id: string | number,
	action_name: string,
	params: unknown = null
): Promise<Pm2TriggerResult[]> => {
	return new Promise((resolve, reject) => {
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/ban-types
		pm2.trigger(pm_id, action_name, params, (err, result) => {
			if (err) {
				reject(err);
			} else {
				resolve(result);
			}
		});
	});
};

export interface ZpageDependencyCheck {
	depName: string;
	checkDep: () => unknown;
}

export interface ZpageDependencies {
	readyzDependencies: ZpageDependencyCheck[];
	healthzDependencies: ZpageDependencyCheck[];
}

export function getZpagesRouter(dependencies: ZpageDependencies) {
	const functionName = 'getZpagesRouter';
	const startTime = new Date();
	const { readyzDependencies, healthzDependencies } = dependencies;

	const router = Router();

	function getHealthZ() {
		const mappedDeps = healthzDependencies.map((item) => [item.depName, item.checkDep()]);
		return {
			startTime,
			upTime: process.uptime(),
			resourceUse: process.resourceUsage(),
			calledServices: Object.fromEntries(mappedDeps),
			requestStats: getRequestStats(),
		};
	}

	tx2.action('get-healthz', (cb) => {
		cb({ getHealthZ: getHealthZ(), version: process.env.version });
	});

	router.get('/livez', (request: Request, response: Response) => {
		response.status(200).send();
	});

	router.get('/readyz', (request: Request, response: Response) => {
		// eslint-disable-next-line prefer-const
		let isReady = true;
		for (const dep of readyzDependencies) {
			if (!dep.checkDep()) isReady = false;
			if (!isReady) break;
		}
		response.status(isReady ? 200 : 500).send();
	});

	router.get('/healthz', (request: Request, response: Response) => {
		const body = {
			process: {
				pm2Id: process.env.pm_id,
				name: process.env.name,
				version: process.env.version,
			},
			...getHealthZ(),
		};
		response.status(200).send(body);
	});

	router.get('/all-healthz', async (request: Request, response: Response) => {
		try {
			const healthzData = await pm2Trigger('all', 'get-healthz');
			response.status(200).send(
				healthzData
					.map((item) => {
						return {
							atTime: new Date(item.at).toISOString(),
							process: {
								namespace: item.process.namespace,
								name: item.process.name,
								pm2Id: item.process.pm_id,
								version: item.data.return.version,
							},
							...item.data.return.getHealthZ,
						};
					})
					.sort((itemA, itemB) => itemA.process.pm_id - itemB.process.pm_id)
			);
		} catch (e) {
			logger.error({ error: e, moduleName, functionName, path: request.path }, 'Route handler error');
			response.status(500).send(e);
		}
	});

	router.get('/pm2healthz', async (request: Request, response: Response) => {
		let errorFrom = '';
		try {
			errorFrom = 'connect';
			await pm2Connect();

			errorFrom = 'list';
			const pm2Processes = (await pm2List()) as pm2.ProcessDescription[];

			pm2.disconnect(); // does not take a callback

			response.status(200).send(
				pm2Processes.map((item) => {
					const { name, pm_id, pid, monit, pm2_env } = item;
					const {
						instances,
						exec_mode,
						status,
						created_at,
						pm_uptime,
						restart_time,
						version,
						node_version,
						axm_monitor,
					} = pm2_env as any;
					const valueOrNa = (value: unknown) => value || 'not available';
					return {
						name,
						pm2Id: pm_id,
						pid,
						memory: valueOrNa(monit?.memory),
						cpu: valueOrNa(monit?.cpu),
						instances: valueOrNa(instances),
						execMode: valueOrNa(exec_mode),
						status: valueOrNa(status),
						startTime: valueOrNa(created_at),
						uptime: valueOrNa(pm_uptime),
						restartCount: valueOrNa(restart_time),
						version: valueOrNa(version),
						nodeVersion: valueOrNa(node_version),
						axmMonitor: valueOrNa(axm_monitor),
					};
				})
			);
		} catch (e) {
			logger.error({ error: e, moduleName, functionName, path: request.path }, 'Route handler error');
			response.status(500).send({ message: `pm2 ${errorFrom} error`, error: e });
		}
	});

	return router;
}
