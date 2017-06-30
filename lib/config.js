/**
 * Created by taoyuan on 2017/6/29.
 */

const _ = require('lodash');
const fs = require('fs-extra');
const path = require('path');
const utils = require('./utils');

class Config {
	constructor(path) {
		this.path = utils.getImpackFile(path);
		this.load();
	}

	load() {
		this._data = utils.load(this.path);
		this.update('components', parseComponents);
	}

	resolve(dest) {
		this.get('components').forEach(c => {
			c.dir = c.dir || (dest && path.resolve(dest, c.relative));
			const collected = fs.existsSync(c.dir);
			if (!collected) return;
			const p = path.resolve(c.dir, 'package.json');
			const pkg = fs.existsSync(p) ? fs.readJsonSync(p) : null;
			const name = pkg ? pkg.name : c.name;
			const possibles = [
				path.join(c.dir, 'process.yml'),
				path.join(c.dir, 'process.json'),
			];
			const service = possibles.find(fs.existsSync.bind(fs));
			Object.assign(c, {name, pkg, collected, service});
		});
		return this;
	}

	get(key) {
		return _.get(this._data, key);
	}

	set(key, value) {
		return _.set(this._data, key, value);
	}

	has(key) {
		return _.has(this._data, key, value);
	}

	del(key) {
		return _.unset(this._data, key);
	}

	unset(key) {
		return _.unset(this._data, key);
	}

	clear() {
		this._data = {};
	}

	update(key, fn) {
		const value = fn(this.get(key));
		if (value && value.then) {
			return value.then(value => this.set(value));
		}
		return this.set(key, value);
	}
}

module.exports = Config;

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
