/**
 * Created by taoyuan on 2017/6/29.
 */

const _ = require('lodash');
const path = require('path');
const fse = require('fs-extra');
const assert = require('assert');
const download = require('./download');
const Config = require('./config');
const utils = require('./utils');

const HOOKS = ['before-install', 'after-install', 'before-remove', 'after-remove', 'before-upgrade', 'after-upgrade'];

class Packer {
	constructor(impackFile) {
		this.config = new Config(impackFile);
		this.root = path.dirname(this.config.path);
	}

	_getImpackDir(dir) {
		return dir || path.resolve(this.root, '.impack');
	}

	_getHooksDir(dir) {
		return dir || path.resolve(this.root, '.hooks');
	}

	async collect(dest, options) {
		dest = this._getImpackDir(dest);
		options = options || {};
		this.config.resolve(dest);
		const components = this.config.get('components');

		if (options.skipDownload) return;

		for (let i = 0; i < components.length; i++) {
			const c = components[i];
			fse.ensureDirSync(c.dir);
			await download(c.uri, c.dir);
		}
	}

	genhooks(src, dest, options) {
		src = this._getImpackDir(src);
		dest = this._getHooksDir(dest);
		this.config.resolve(src);
		let {stagehome, rebuild} = options || {};
		stagehome = stagehome || '/opt/' + this.config.get('home');

		const components = this.config.get('components');
		components.forEach(c => c.stagepath = c.stagepath || path.join(stagehome, c.relative));

		fse.ensureDirSync(dest);

		// Add rebuild script to after install if rebuild specified
		if (rebuild) {
			utils.renderAndAppend('rebuild', {components}, path.join(dest, 'after-install'));
		}

		// Generate hooks
		const hooks = _.fromPairs(HOOKS.map(key => ([key, []])));

		_.forEach(components, c => {
			const options = _.get(c.pkg, 'oodopack');
			if (options) {
				HOOKS.forEach(key => options[key] && hooks[key].push(Object.assign({script: options[key]}, c)));
			}
		});

		_.forEach(hooks, (entries, hook) => {
			if (_.isEmpty(entries)) return;
			utils.renderAndAppend('hook', {hook, entries}, path.join(dest, hook));
		});

		// Append startup and teardown hooks
		utils.renderAndAppend('startup', {components}, path.join(dest, 'after-install'));
		utils.renderAndAppend('teardown', {components}, path.join(dest, 'before-remove'));
	}

	_parsePackOptions(dir, hooksDir, options) {
		if (typeof hooksDir === 'object') {
			options = hooksDir;
			hooksDir = null;
		}
		if (typeof dir === 'object') {
			options = dir;
			dir = null;
			hooksDir = null;
		}
		dir = this._getImpackDir(dir);
		this.config.resolve(dir);
		options = Object.assign({
			chdir: dir,
			architecture: 'armhf',
			name: this.config.get('name'),
			version: this.config.get('version'),
			package: this.config.get('name') + '.deb',
		}, options);

		hooksDir = this._getHooksDir(hooksDir);
		if (hooksDir) {
			const files = fse.readdirSync(hooksDir);
			const scripts = _.fromPairs(_.map(files, name => ([name, path.resolve(hooksDir, name)])));
			Object.assign(options, scripts);
		}

		return utils.normalizePackOptions(options);
	}

	/**
	 *
	 * @param {String|Object} [dir] The directory of files. Default is [cwd]/.impack
	 * @param {String|Object} [hooksDir] The directory of hooks. Default is [cwd]/.hooks
	 * @param {Object} [options] The options for fpm. Details see: fpm --help
	 * @returns {Promise.<*>}
	 */
	async pack(dir, hooksDir, options) {
		options = this._parsePackOptions(dir, hooksDir, options);
		return await utils.exec(['fpm', ...utils.argumentize(options)].join(' '));
	}

	/**
	 *
	 * @param {String|Object} [dir] The directory of files. Default is [cwd]/.impack
	 * @param {String|Object} [hooksDir] The directory of hooks. Default is [cwd]/.hooks
	 * @param {Object} [options] The options for fpm. Details see: fpm --help
	 * @returns {*}
	 */
	packSync(dir, hooksDir, options) {
		options = this._parsePackOptions(dir, hooksDir, options);
		return utils.execSync(['fpm', ...utils.argumentize(options)].join(' '));
	}
}

module.exports = Packer;

