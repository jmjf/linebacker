// Some experiments with eventing
import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import EventEmitter from 'events';

const ee = new EventEmitter();
ee.on('get/', (ip) => console.log(`event: request received from ${ip}`));
ee.on('alt/', (ip) => setTimeout(() => console.log(`event: alt called by ${ip}`), 500));

// load the environment
dotenv.config({ path: './env/dev.env' });

const app: Express = express();
const port = process.env.PORT || 3000; // if PORT is undefined, default to 3000

app.get('/', (req: Request, res: Response) => {
	// see https://expressjs.com/en/api.html#req for details of Request
	ee.emit('get/', req.ip);
	console.log('from handler /');
	res.send('express-ts-api says "Hello, world!"\n');
});

app.get('/alt', (req: Request, res: Response) => {
	ee.emit('alt/', req.ip);
	console.log('from handler /alt');
	res.send('express-ts-api alternate');
});

app.listen(port, () => {
	console.log(`express-ts-api running at https://localhost:${port}`);
});
