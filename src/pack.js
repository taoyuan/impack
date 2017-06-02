'use strict';

const _ = require('lodash');
const fs = require('fs-extra');
const path = require('path');
const PromiseA = require('bluebird');
const exec = require('child_process').exec;
const download = require('./download');
const utils = require('./utils');

const POSSIBLE_IMPACK_FILES = ['impack.json', 'impack.yaml', 'impack.yml'];
const NPM_INSTALL = 'npm install --unsafe-perm --no-optional --registry https://registry.npm.taobao.org';

/**
 *
 * @param {String} target
 * @param {String|Object} [dest]
 * @param {Object} [opts]
 * @param {Boolean} [opts.ignoreScripts]
 */
function pack(target, dest, opts) {
	if (_.isObject(dest)) {
		opts = dest;
		dest = null;
	}
	opts = opts || {};

	let impackFile = target;
	const stats = fs.statSync(target);
	if (stats.isDirectory()) {
		impackFile = utils.findFile(target, POSSIBLE_IMPACK_FILES);
	}
	if (!impackFile) {
		throw new Error('Can not find impack file in: ' + target);
	}
	const dir = path.dirname(impackFile);
	if (!dest) {
		dest = path.join(dir, '.impack');
	}
	fs.ensureDirSync(dest);
	const config = utils.load(impackFile);
	let components = config.comps || config.components || config.deps || config.dependencies;
	if (!components) {
		throw new Error('Property "components" is required')
	}
	components = utils.resolveComponents(components);
	return PromiseA.map(_.toPairs(components), ([name, url]) => {
		const output = path.resolve(dest, name);
		if (!url) {
			fs.ensureDirSync(output);
		}
		return download(url, path.resolve(dest, output)).then(() => output);
	}).map(dir => {
		const cmd = [NPM_INSTALL];
		if (opts.ignoreScripts) {
			cmd.push('--ignore-scripts');
		}

		return PromiseA.fromCallback(cb => exec(cmd.join(' '), {cwd: dir}))
			.catch(e => console.error(e.message));
	});
}

module.exports = pack;
