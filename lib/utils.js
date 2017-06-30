'use strict';

const assert = require('assert');
const _ = require('lodash');
const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const Handlebars = require('handlebars');
const inflection = require('inflection');
const cp = require('child_process');

const POSSIBLE_IMPACK_FILES = ['impack.json', 'impack.yaml', 'impack.yml'];

function findImpackFile(path) {
	let impackFile = path;
	const stats = fs.statSync(path);
	if (stats.isDirectory()) {
		impackFile = findFile(path, POSSIBLE_IMPACK_FILES);
	}
	if (impackFile && fs.existsSync(impackFile)) {
		return impackFile;
	}
}

function getImpackFile(path) {
	const answer = findImpackFile(path);
	assert(answer, 'Can not find impack file from ' + path);
	return answer;
}

function findFile(dir, possibles) {
	const file = _.find(possibles, file => fs.existsSync(path.join(dir, file)));
	if (file) return path.join(dir, file);
}

function getImpackDest(dest, impackFile) {
	if (dest) return dest;
	return path.join(path.dirname(impackFile), '.impack');
}

function loadImpackFile(impackFile) {
	if (typeof impackFile !== 'string') {
		return impackFile;
	}
	let config = load(impackFile);
	config.components = config.components || config.deps || config.dependencies || [];
	const dir = path.dirname(impackFile);
	const p = path.resolve(dir, 'package.json');
	if (fs.existsSync(p)) {
		config = Object.assign(_.pick(require(p), ['name', 'version']), config);
	}
	assert(config.name, 'Invalid impack file. "name" is required');
	return config
}

/**
 *
 * @param components
 * @param result
 * @param parent
 * @returns {*|Array}
 */
function parseComponents(components, result, parent) {
	result = result || [];
	parent = parent || '';
	_.forEach(components, (component, name) => {
		const relative = parent + (parent ? '/' : '') + name;
		if (!component || _.isString(component)) {
			return result.push({name, relative, uri: component});
		}
		parseComponents(component, result, relative);
	});

	return result;
}

function parseImpackConfig(impackFileOrConfig, dest) {
	const config = typeof impackFileOrConfig === 'string' ? loadImpackFile(impackFileOrConfig) : impackFileOrConfig;
	config.components = parseComponents(config.components);
	if (dest) {
		config.components.forEach(c => c.dir = path.resolve(dest, c.relative))
	}
	return config;
}

function resolveComponents(config) {
	config.components = config.components.map(c => {
		if (!c.dir) return c;
		const downloaded = fs.existsSync(c.dir);
		const pkgpath = path.resolve(c.dir, 'package.json');
		const pkg = fs.existsSync(pkgpath) ? fs.readJsonSync(pkgpath) : null;
		const name = pkg ? pkg.name : c.name;
		const service = [path.join(c.dir, 'process.yml'), path.join(c.dir, 'process.json')].find(fs.existsSync.bind(fs));
		return Object.assign(c, {name, pkg, downloaded, service});
	});
	return config;
}

function resolveImpackConfig(impackFileOrConfig, dest) {
	let config = loadImpackFile(impackFileOrConfig);
	parseImpackConfig(config, dest);
	resolveComponents(config);
	return config;
}

function load(file) {
	const ext = path.extname(file);
	if (ext === '.json') {
		return fs.readJSONSync(file);
	} else if (['.yaml', '.yml'].includes(ext)) {
		return yaml.safeLoad(fs.readFileSync(file, 'utf8'));
	}
	throw new Error('Unsupported file: ' + file);
}

function append(file, content) {
	let data = '#!/usr/bin/env bash\n';
	if (fs.existsSync(file)) {
		data = fs.readFileSync(file).toString();
	}
	fs.writeFileSync(file, data + '\n' + content);
}

function compile(template) {
	const tpl = fs.readFileSync(path.join(__dirname, `templates/${template}.hbs`)).toString();
	return Handlebars.compile(tpl);
}

function render(template, context) {
	return compile(template)(context);
}

function renderAndAppend(template, context, file) {
	append(file, render(template, context));
}

function argumentize(options) {
	const args = [];
	_.forEach(options, (value, key) => {
		if (!key) return;
		if (value !== false) {
			if (key.length === 1) {
				args.push('-' + key);
			} else {
				args.push('--' + inflection.dasherize(inflection.underscore(key)));
			}
			if (value !== true) { // this is an option. do not need a value.
				args.push(`"${value}"`);
			}
		}
	});
	return args;
}

function exec(command) {
	return new Promise((resolve, reject) => doExecute(resolve, reject, command));
}

function doExecute(resolve, reject, command) {
	cp.exec(command, (error, stdout, stderr) => {
		if (error) {
			return reject(stderr);
		}

		resolve(stdout);
	});
}

function execSync(command) {
	return cp.execSync(...arguments);
}

const PACK_OUTPUTS = {
	deb: {
		debCompression: 'xz',
		debUser: 'root',
		debGroup: 'root'
	}
};

function normalizePackOptions(options) {
	options = options || {};
	assert(options.chdir, '"chdir" is required');
	assert(options.name, '"name" is required');
	assert(getVersion(options.version, options.chdir), '"version" is required');
	assert(options.architecture, '"architecture" is required');
	assert(options.package, '"package" for output is required');

	const outputType = options.outputType || 'deb';
	return Object.assign({
		inputType: 'dir',
		outputType,
	}, PACK_OUTPUTS[outputType], options);
}

function getVersion(version, dir) {
	if (version) return version;
	const p = path.resolve(dir, 'package.json');
	const pkg = fs.existsSync(p) ? require(p) : null;
	return pkg && pkg.version;
}

module.exports = {
	load,
	getImpackFile,
	getImpackDest,
	findFile,
	parseImpackConfig,
	resolveComponents,
	resolveImpackConfig,
	renderAndAppend,
	argumentize,
	exec,
	execSync,
	normalizePackOptions,
};
