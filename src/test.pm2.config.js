module.exports = {
	apps: [
		{
			name: 'linebacker-api',
			// script: 'ts-node',
			// args: 'src/apiSrvExpTypeorm.ts',
			script: 'dist/apiSrvExpTypeorm.js',
			env: {
				APP_ENV: 'dev',
			},
			instances: 1,
			exec_mode: 'fork',
			instance_var: 'PM2_INSTANCE_ID',
		},
		{
			name: 'store-queue-watcher',
			// script: 'ts-node',
			// args: 'src/rcvSrvExpTypeorm.ts',
			script: 'dist/rcvSrvExpTypeorm.js',
			env: {
				APP_ENV: 'dev',
			},
			instances: 2,
			exec_mode: 'cluster',
			instance_var: 'PM2_INSTANCE_ID',
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
