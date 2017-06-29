const execSync = require('child_process').execSync;
const utils = require('./utils');

module.exports = fpm;

function fpm(options) {
	return utils.exec(['fpm', ...utils.argumentize(options)].join(' '));
}

fpm.sync = function (options) {
	return execSync(['fpm', ...utils.argumentize(options)].join(' '));
};
