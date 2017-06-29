'use strict';

const _ = require('lodash');
const fs = require('fs-extra');
const path = require('path');
const utils = require('./utils');

const HOOKS = ['before-install', 'after-install', 'before-remove', 'after-remove', 'before-upgrade', 'after-upgrade'];

module.exports = function ({buildhome, stagehome, dest, rebuild = false}) {
	const components = findComponents(buildhome).map(c => Object.assign({stagepath: path.join(stagehome, c.relative)}, c));
	if (rebuild) {
		utils.renderAndAppend('rebuild', {components}, path.join(dest, 'after-install'));
	}
	generateHooks(components, dest);
	utils.renderAndAppend('startup', {components}, path.join(dest, 'after-install'));
	utils.renderAndAppend('teardown', {components}, path.join(dest, 'before-remove'));
};

function findComponents(root, components, parent) {
	components = components || [];
	parent = parent || '';

	fs.readdirSync(root)
		.map(file => ({name: file, buildpath: path.join(root, file)}))
		.filter(c => fs.lstatSync(c.buildpath).isDirectory())
		.forEach(({name, buildpath}) => {
			const pkgpath = path.join(buildpath, 'package.json');
			const service = fs.existsSync(path.join(buildpath, 'process.yml'));
			const relative = parent + (parent ? '/' : '') + name;
			if (fs.existsSync(pkgpath)) {
				const pkg = fs.readJsonSync(pkgpath);
				components.push({name: pkg.name, service, pkg, relative, buildpath});
			} else {
				findComponents(buildpath, components, relative);
			}
		});

	return components;
}

function generateHooks(components, dest) {
	// initial hooks
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
}
