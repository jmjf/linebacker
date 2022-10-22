import { Application, Request, Response } from 'express';
import path from 'path';
import { Result } from '../../common/core/Result';

const moduleName = path.basename(module.filename);

export interface ZpageDependencyCheck {
	depName: string;
	depCheckFunction: () => Promise<Result<boolean, Error>>;
}

export interface ZpageDependencies {
	readyzDependencies: ZpageDependencyCheck[];
}

export function addZpagesRoutes(app: Application, dependencies: ZpageDependencies) {
	const functionName = 'addZpagesRoutes';
	const startTime = new Date();
	const { readyzDependencies } = dependencies;

	app.get('/api/zpages/livez', (request: Request, response: Response) => {
		response.status(200).send();
	});

	app.get('/api/zpages/readyz', async (request: Request, response: Response) => {
		// eslint-disable-next-line prefer-const
		let isReady = true;
		for (const dep of readyzDependencies) {
			const depResult = await dep.depCheckFunction();
			if (depResult.isErr()) isReady = false;
			if (!isReady) break;
		}
		response.status(isReady ? 200 : 500).send();
	});

	app.get('/api/zpages/healthz', (request: Request, response: Response) => {
		const body = {
			startTime,
			upTime: process.uptime(),
			resourceUse: process.resourceUsage(),
		};
		response.status(200).send(body);
	});
}
