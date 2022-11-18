/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('node:fs/promises');

async function main() {
	const path = './dev-notes';
	try {
		const files = await fs.readdir(path);
		for (const file of files) {
			const isTarget = file.endsWith('.md') && '0123456789'.includes(file[0]) && file.split('-')[0].includes('.');
			if (isTarget) {
				console.log(`Rename ${path}/${file} -> ${path}/0${file}`);
				await fs.rename(`${path}/${file}`, `${path}/0${file}`);
			} else {
				console.log(`Skip ${file}`);
			}
		}
	} catch (err) {
		console.error(err);
	}
}

main();
