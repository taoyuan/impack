'use strict';

const assert = require('assert');
const _ = require('lodash');
const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const Handlebars = require('handlebars');
const inflection = require('inflection');
const cpp = require('child-process-promise');
const chalk = require('chalk');

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
			if (/[ ]/.test(value)) {
				value = `"${value}"`;
			}
			if (value !== true) { // this is an option. do not need a value.
				args.push(value);
			}
		}
	});
	return args;
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
	// assert(options.chdir, '"chdir" is required');
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
	const p = path.resolve(dir || '.', 'package.json');
	const pkg = fs.existsSync(p) ? require(p) : null;
	return pkg && pkg.version;
}

function spawn(command, args, options = {silent: false}) {
	args = args || [];

	const {silent} = options;
	if (!silent) {
		console.log(chalk.magenta.bold('==>'), chalk.green([command, ...args].join(' ')));
		console.log('>', `${options.cwd || process.cwd()}`);
	}

	const promise = cpp.spawn(command, args, options);
	const childProcess = promise.childProcess;
	childProcess.stdout.on('data', data => !silent && process.stdout.write(chalk.gray(data)));
	childProcess.stderr.on('data', data => !silent && process.stdout.write(chalk.red(data)));
	return promise;
}

module.exports = {
	load,
	getImpackFile,
	findFile,
	renderAndAppend,
	argumentize,
	normalizePackOptions,
	spawn,
};
