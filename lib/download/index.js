'use strict';

const git = require('./git');

module.exports = function (target, dest, opts) {
	// TODO support more protocols
	return git(target, dest, opts);
};
