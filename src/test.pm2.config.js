const baseConfig = {
	env: {
		APP_ENV: 'dev',
	},
	exec_mode: 'cluster',
	instance_var: 'PM2_INSTANCE_ID',
	wait_ready: true,
	listen_timeout: 10000,
};

module.exports = {
	apps: [
		{
			name: 'linebacker-api',
			// script: 'ts-node',
			// args: 'src/apiSrvExpTypeorm.ts',
			script: 'dist/apiSrvExpTypeorm.js',
			instances: 1,
			...baseConfig,
		},
		{
			name: 'store-queue-watcher',
			// script: 'ts-node',
			// args: 'src/rcvSrvExpTypeorm.ts',
			script: 'dist/rcvSrvExpTypeorm.js',
			instances: 2,
			...baseConfig,
		},
		// {
		// 	name: 'logger',
		// 	script: 'splunkLog.sh',
		// 	//args: 'src/rcvSrvExpTypeorm.ts',
		// 	env: {
		// 		APP_ENV: 'dev',
		// 	},
		// 	instances: 1,
		// 	exec_mode: 'fork',
		// 	out_file: '/dev/null',
		// 	err_file: '/dev/null',
		// 	log_file: '/dev/null',
		// },
	],
};
