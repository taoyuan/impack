'use strict';

const _ = require('lodash');
const fs = require('fs-extra');
const path = require('path');
const PromiseA = require('bluebird');
const download = require('./download');
const utils = require('./utils');

const POSSIBLE_IMPACK_FILES = ['impack.json', 'impack.yaml', 'impack.yml'];

/**
 *
 * @param {String} source The impack file or directory contains the impack file
 * @param {String|Object} [dest] The destination directory. Default is .impack in current directory.
 * @return {Promise<Array>}
 */
function pack(source, dest) {
	let impackFile = source;
	const stats = fs.statSync(source);
	if (stats.isDirectory()) {
		impackFile = utils.findFile(source, POSSIBLE_IMPACK_FILES);
	}
	if (!impackFile) {
		throw new Error('Can not find impack file in: ' + source);
	}
	const dir = path.dirname(impackFile);
	if (!dest) {
		dest = path.join(dir, '.impack');
	}
	fs.ensureDirSync(dest);
	const config = utils.load(impackFile);
	let components = config.comps || config.components || config.deps || config.dependencies;
	if (!components) {
		throw new Error('Property "components" is required');
	}
	components = utils.resolveComponents(components);
	return PromiseA.map(_.toPairs(components), ([name, url]) => {
		const output = path.resolve(dest, name);
		if (!url) {
			fs.ensureDirSync(output);
		}
		return download(url, path.resolve(dest, output)).then(() => output);
	});
}

module.exports = pack;
