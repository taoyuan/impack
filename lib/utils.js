'use strict';

const _ = require('lodash');
const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const Handlebars = require('handlebars');
const inflection = require('inflection');
const cp = require('child_process');

function findFile(dir, possibles) {
	const file = _.find(possibles, file => fs.existsSync(path.join(dir, file)));
	if (file) return path.join(dir, file);
}

function resolveComponents(components, result, parent) {
	result = result || {};
	parent = parent || '';
	_.forEach(components, (component, name) => {
		const dir = parent + (parent ? '/' : '') + name;
		if (!component || _.isString(component)) {
			return result[dir] = component;
		}
		resolveComponents(component, result, dir);
	});

	return result;
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

module.exports = {
	findFile,
	resolveComponents,
	load,
	renderAndAppend,
	argumentize,
	exec
};
