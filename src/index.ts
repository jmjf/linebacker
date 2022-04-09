import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';

// load the environment
dotenv.config({ path: './env/dev.env'});

const app: Express = express();
const port = process.env.PORT || 3000; // if PORT is undefined, default to 3000

app.get('/', (req: Request, res: Response) => {
  res.send('express-ts-api says "Hello, world!"\n');
})

app.listen(port, () => {
  console.log(`express-ts-api running at https://localhost:${port}`);
});
