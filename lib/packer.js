/**
 * Created by taoyuan on 2017/6/29.
 */

const _ = require('lodash');
const path = require('path');
const fse = require('fs-extra');
const PromiseA = require('bluebird');
const download = require('./download');
const Config = require('./config');
const utils = require('./utils');

const HOOKS = ['before-install', 'after-install', 'before-remove', 'after-remove', 'before-upgrade', 'after-upgrade'];

class Packer {
	constructor(impackFile, options) {
		options = options || {};
		this.config = new Config(impackFile);
		this.home = path.dirname(this.config.path);
		this.output = path.resolve(this.home, options.output || '.impack');
		this.stagedir = path.resolve(this.output, 'stage');
		this.hooksdir = path.resolve(this.output, 'hooks');
		this.packhome = options.packhome || '/opt/' + this.config.get('name');
		this.config.resolve({stagedir: this.stagedir, packhome: this.packhome});
	}

	/**
	 *
	 * @param {Object} [options]
	 * @returns {Promise.<*>}
	 */
	async collect(options = {}) {
		const {skipHooks} = options;
		const components = this.config.get('components');

		await PromiseA.each(components, c => {
			fse.ensureDirSync(c.stagepath);
			return download(c.uri, c.stagepath);
		});

		if (!skipHooks) {
			this.genhooks(options);
		}
	}

	genhooks(options = {}) {
		const {rebuild} = options;
		const components = this.config.get('components');

		fse.ensureDirSync(this.hooksdir);

		// Add rebuild script to after install if rebuild specified
		if (rebuild) {
			utils.renderAndAppend('rebuild', {components}, path.join(this.hooksdir, 'after-install'));
		}

		// Generate hooks
		const hooks = _.fromPairs(HOOKS.map(key => ([key, []])));

		_.forEach(components, c => {
			const options = _.get(c.pkg, 'impack') || _.get(c.pkg, 'oodopack');
			if (options) {
				HOOKS.forEach(key => options[key] && hooks[key].push(Object.assign({script: options[key]}, c)));
			}
		});

		_.forEach(hooks, (entries, hook) => {
			if (_.isEmpty(entries)) return;
			utils.renderAndAppend('hook', {hook, entries}, path.join(this.hooksdir, hook));
		});

		// Append startup and teardown hooks
		utils.renderAndAppend('startup', {components}, path.join(this.hooksdir, 'after-install'));
		utils.renderAndAppend('teardown', {components}, path.join(this.hooksdir, 'before-remove'));
	}

	_parsePackOptions(options = {}) {
		const architecture = options.architecture || 'armhf';
		options = Object.assign({
			chdir: this.stagedir,
			architecture,
			package: path.resolve(this.output, `${name}_${version}_${architecture}_.deb`),
		}, _.pick(this.config.data, ['name', 'version', 'description', 'maintainer', 'url']), options);

		if (fse.existsSync(this.hooksdir)) {
			const files = fse.readdirSync(this.hooksdir);
			const scripts = _.fromPairs(_.map(files, name => ([name, path.resolve(this.hooksdir, name)])));
			Object.assign(options, scripts);
		}

		return utils.normalizePackOptions(options);
	}

	/**
	 *
	 * @param {Object} [options] The options for fpm. Details see: fpm --help
	 * @returns {Promise.<*>}
	 */
	async pack(options = {}) {
		options = this._parsePackOptions(options);
		const command = ['fpm', ...utils.argumentize(options), `.=${this.packhome}`].join(' ');
		return utils.exec(command);
	}

	/**
	 *
	 * @param {Object} [options] The options for fpm. Details see: fpm --help
	 * @returns {*}
	 */
	packSync(options = {}) {
		options = this._parsePackOptions(options);
		const command = ['fpm', ...utils.argumentize(options), `stage=${this.packhome}`].join(' ');
		return utils.execSync(command);
	}
}

module.exports = Packer;

