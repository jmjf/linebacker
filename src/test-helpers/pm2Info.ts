import pm2 from 'pm2';
import util from 'util';

// eslint-disable-next-line @typescript-eslint/ban-types
function promisifyPm2(f: Function, theThis: unknown) {
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

			f.call(theThis, ...args); // call the original function
		});
	};
}

const pm2Connect = promisifyPm2(pm2.connect, pm2);
const pm2List = promisifyPm2(pm2.list, pm2);
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/ban-types
const pm2GetVersion = promisifyPm2(pm2.getVersion, pm2);
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/ban-types
const pm2Get = promisifyPm2(pm2.get, pm2);

async function main() {
	await pm2Connect();

	const version = await pm2GetVersion();
	const allKeys = await pm2Get('all');

	const list = await pm2List();

	pm2.disconnect();

	console.log('list', list);
}

main();
// pm2.list((err, list) => {
// 	console.log('err', err);
// 	console.log(
// 		'list',
// 		list.map((item) => {
// 			const { name, pm_id, pid, monit, pm2_env } = item;
// 			const {
// 				instances,
// 				exec_mode,
// 				status,
// 				created_at,
// 				pm_uptime,
// 				restart_time,
// 				version,
// 				node_version,
// 				axm_monitor,
// 			} = pm2_env as any;
// 			const valueOrNa = (value: unknown) => value || 'not available';
// 			return {
// 				name,
// 				pm2ProcessId: pm_id,
// 				pid,
// 				memory: valueOrNa(monit?.memory),
// 				cpu: valueOrNa(monit?.cpu),
// 				instances: valueOrNa(instances),
// 				execMode: valueOrNa(exec_mode),
// 				status: valueOrNa(status),
// 				startTime: valueOrNa(created_at),
// 				uptime: valueOrNa(pm_uptime),
// 				restartCount: valueOrNa(restart_time),
// 				version: valueOrNa(version),
// 				node_version: valueOrNa(node_version),
// 				axm_monitor: valueOrNa(axm_monitor),
// 			};
// 		})
// 	);

// 	pm2.disconnect();
// 	});
// });
