import { Application, Request, Response } from 'express';
import path from 'path';

const moduleName = path.basename(module.filename);

export interface ZpageDependencyCheck {
	depName: string;
	checkDep: () => unknown;
}

export interface ZpageDependencies {
	readyzDependencies: ZpageDependencyCheck[];
	healthzDependencies: ZpageDependencyCheck[];
}

export function addZpagesRoutes(app: Application, dependencies: ZpageDependencies) {
	const functionName = 'addZpagesRoutes';
	const startTime = new Date();
	const { readyzDependencies, healthzDependencies } = dependencies;

	app.get('/api/zpages/livez', (request: Request, response: Response) => {
		response.status(200).send();
	});

	app.get('/api/zpages/readyz', (request: Request, response: Response) => {
		// eslint-disable-next-line prefer-const
		let isReady = true;
		for (const dep of readyzDependencies) {
			if (!dep.checkDep()) isReady = false;
			if (!isReady) break;
		}
		response.status(isReady ? 200 : 500).send();
	});

	app.get('/api/zpages/healthz', (request: Request, response: Response) => {
		const mappedDeps = healthzDependencies.map((item) => [item.depName, item.checkDep()]);
		const body = {
			startTime,
			upTime: process.uptime(),
			resourceUse: process.resourceUsage(),
			calledServices: Object.fromEntries(mappedDeps),
		};
		response.status(200).send(body);
	});
}
