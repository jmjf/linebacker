import { Request, Response, Router } from 'express';
import path from 'path';
import { getRequestStats } from '.';

const moduleName = path.basename(module.filename);

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
		const mappedDeps = healthzDependencies.map((item) => [item.depName, item.checkDep()]);
		const body = {
			startTime,
			upTime: process.uptime(),
			resourceUse: process.resourceUsage(),
			calledServices: Object.fromEntries(mappedDeps),
			requestStats: getRequestStats(),
		};
		response.status(200).send(body);
	});

	return router;
}
