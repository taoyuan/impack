/**
 * Created by taoyuan on 2017/6/29.
 */

const _ = require('lodash');
const path = require('path');
const fse = require('fs-extra');
const PromiseA = require('bluebird');
const chalk = require('chalk');
const download = require('./download');
const Config = require('./config');
const utils = require('./utils');

const HOOKS = ['before-install', 'after-install', 'before-remove', 'after-remove', 'before-upgrade', 'after-upgrade'];

class Packer {
	constructor(impackFile, options) {
		options = options || {};
		this.silent = options.silent;
		this.config = new Config(impackFile);
		this.home = path.dirname(this.config.path);
		this.output = path.resolve(this.home, options.output || '.impack');
		this.stagedir = path.resolve(this.output, 'stage');
		this.hooksdir = path.resolve(this.output, 'hooks');
		this.packhome = options.packhome || '/opt/' + this.config.get('name');
		this.update();
	}

	update() {
		this.config.resolve({stagedir: this.stagedir, packhome: this.packhome});
	}

	/**
	 *
	 * @param {Object} [options]
	 * @param {Boolean} [options.rebuild] Rebuild component after install
	 * @returns {Promise.<*>}
	 */
	async collect(options = {}) {
		const {skipHooks} = options;
		const components = this.config.get('components');
		console.log(chalk.blue('==>'), chalk.bold('Collecting components ...'));
		await PromiseA.each(components, c => {
			fse.ensureDirSync(c.stagepath);
			return download(c.uri, c.stagepath).catch(e => {
				console.error(`error when downloading ${c.uri}`);
				throw e;
			});
		});

		if (!skipHooks) {
			this.genhooks(options);
		}
	}

	/**
	 *
	 * @param {Object} [options]
	 * @param {Boolean} [options.rebuild] Rebuild component after install
	 */
	genhooks(options = {}) {
		console.log(chalk.blue('==>'), chalk.bold('Generating hooks ...'));
		this.update();

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

	/**
	 * Run npm command iterate all node modules
	 * @param command
	 * @param options
	 */
	async npm(command, options = {}) {
		this.update();
		if (typeof command === 'object') {
			options = command;
			command = null;
		}
		command = command || 'install';
		const defaults = {
			unsafePerm: true
		};
		if (command === 'install') {
			Object.assign(defaults, {
				unsafePerm: true,
				production: true,
			});
		}
		options = Object.assign({}, defaults, options);
		const args = [command, ...utils.argumentize(options)];
		const components = this.config.get('components').filter(c => c.pkg);
		return PromiseA.mapSeries(components, c => utils.spawn('npm', args, {cwd: c.stagepath, silent: this.silent}));
	}

	_parsePackOptions(options = {}) {
		const opts = _.pick(this.config.data, ['name', 'version', 'description', 'maintainer', 'url']);
		const architecture = options.architecture || 'armhf';
		options = Object.assign({
			chdir: this.stagedir,
			architecture,
			package: path.resolve(this.output, `${opts.name}_${opts.version}_${architecture}_.deb`),
		}, opts, options);

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
		console.log(chalk.blue('==>'), chalk.bold('Packing ...'));
		options = this._parsePackOptions(options);
		const args = [...utils.argumentize(options), `.=${this.packhome}`];
		return utils.spawn('fpm', args, {silent: this.silent});
	}
}

module.exports = Packer;

