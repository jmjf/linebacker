import { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { delay } from './common/utils/utils';

export async function shutdown(abortController: AbortController, server: Server, typeormDataSource: DataSource) {
	abortController.abort();

	// stop accepting requests; give in-flight a chance to finish
	server.close();
	await delay(5000);

	// close database connection
	await typeormDataSource.destroy();

	process.exit(0);
}
