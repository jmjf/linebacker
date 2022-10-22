import { Application, Request, Response } from 'express';
import path from 'path';

const moduleName = path.basename(module.filename);

export function addZpagesRoutes(app: Application) {
	const functionName = 'addZpagesRoutes';
	const startTime = new Date();

	app.get('/api/zpages/livez', (request: Request, response: Response) => {
		response.status(200).send();
	});

	app.get('/api/zpages/readyz', (request: Request, response: Response) => {
		response.status(200).send();
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
