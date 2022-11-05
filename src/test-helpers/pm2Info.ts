import pm2 from 'pm2';

pm2.connect((err) => {
	if (err) {
		console.log('err', err);
		process.exit(2);
	}

	pm2.list((err, list) => {
		console.log('err', err);
		console.log('list', list);

		pm2.disconnect();
	});
});
