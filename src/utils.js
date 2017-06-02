'use strict';

const _ = require('lodash');
const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');

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

module.exports = {
	findFile,
	resolveComponents,
	load
};
