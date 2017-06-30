'use strict';

const {Packer} = require('..');

const packer = new Packer(__dirname);

(async() => {
	try {
		await packer.collect();
		await packer.npm();
		await packer.pack();
	} catch (e) {
		console.error(e);
		process.exit(1);
	}
})();
