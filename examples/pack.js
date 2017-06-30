'use strict';

const {Packer} = require('..');

const packer = new Packer(__dirname);

(async() => {
	try {
		await packer.collect();
		packer.genhooks();
		const output = await packer.pack();
		console.log(output);
	} catch (e) {
		console.error(e);
		process.exit(1);
	}
})();

