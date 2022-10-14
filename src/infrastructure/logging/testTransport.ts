import pump from 'pump';
import build from 'pino-abstract-transport';
import { pipeline, Transform } from 'stream';
import SonicBoom from 'sonic-boom';
import { once } from 'events';

const destination = new SonicBoom({ dest: 1, sync: false });

function transport() {
	return build(
		async function (source) {
			for await (const obj of source) {
				const toDrain = !destination.write(JSON.stringify(obj) + '\n');
				if (toDrain) {
					await once(destination, 'drain');
				}
			}
		},
		{
			async close(err) {
				destination.end();
				await once(destination, 'close');
			},
		}
	);
}

const pst = transport();
pump(process.stdin, pst);
