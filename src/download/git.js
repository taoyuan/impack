const debug = require('debug')('impack:download:git');
const downloadUrl = require("download");
const gitclone = require("git-clone");
const PromiseA = require('bluebird');
const rm = require("fs-extra").removeSync;

/**
 * Expose `download`.
 */

module.exports = download;

/**
 * Download `repo` to `dest` and callback `fn(err)`.
 *
 * @param {String} target
 * @param {String} dest
 * @param {Object|Function} [opts]
 * @param {Boolean} [opts.clone]
 * @param {Function} [fn]
 */

function download(target, dest, opts, fn) {
	if (typeof opts === "function") {
		fn = opts;
		opts = null
	}
	opts = opts || {};
	let clone = opts.clone || false;

	const repo = normalize(target);
	let url = getUrl(repo, clone);
	if (url && typeof url === 'object' && url.url) {
		if (typeof url.clone === 'boolean') {
			clone = url.clone
		}
		url = url.url;
	}

	return PromiseA.try(() => {
		if (clone) {
			const checkout = repo.checkout && repo.checkout !== 'master' ? repo.checkout : null;
			debug('Cloning from:', url, checkout ? '#' + checkout : '');
			return PromiseA.fromCallback(cb => gitclone(url, dest, {checkout}, cb)).then(() => rm(dest + "/.git"));
		} else {
			debug('Downloading from:', url);
			return PromiseA.resolve(downloadUrl(url, dest, {extract: true, strip: 1, mode: "666", headers: {accept: "application/zip"}}));
		}
	}).asCallback(fn);
}

/**
 * Normalize a repo string.
 *
 * @param {String} repo
 * @return {Object}
 */

function normalize(repo) {
	const regex = /^((github|gitlab|bitbucket|oschina):)?((.+):)?([^/]+)\/([^#]+)(#(.+))?$/;
	const match = regex.exec(repo);
	const type = match[2] || "github";
	let host = match[4] || null;
	const owner = match[5];
	const name = match[6];
	const checkout = match[8] || 'master';

	if (host === null) {
		if (type === "github") {
			host = "github.com";
		} else if (type === "gitlab") {
			host = "gitlab.com";
		} else if (type === "bitbucket") {
			host = "bitbucket.com";
		} else if (type === 'oschina') {
			host = "git.oschina.net";
		}
	}

	return {
		type,
		host,
		owner,
		name,
		checkout
	}
}

/**
 * Add HTTPs protocol to url in none specified.
 *
 * @param {String} url
 * @return {String}
 */

function addProtocol(url) {
	if (!/^(f|ht)tps?:\/\//i.test(url))
		url = "https://" + url;

	return url
}

/**
 * Return a zip or git url for a given `repo`.
 *
 * @param {Object} repo
 * @param {Boolean} [clone]
 * @return {String|Object}
 */

function getUrl(repo, clone) {
	let url;

	if (repo.type === "github") {
		url = github(repo, clone);
	} else if (repo.type === "gitlab") {
		url = gitlab(repo, clone);
	} else if (repo.type === "bitbucket") {
		url = bitbucket(repo, clone);
	} else if (repo.type === "oschina") {
		url = oschina(repo, clone);
	} else {
		url = github(repo, clone);
	}

	return url
}

/**
 * Return a GitHub url for a given `repo` object.
 *
 * @param {Object} repo
 * @param {Boolean} [clone]
 * @return {String}
 */

function github(repo, clone) {
	let url;

	if (clone)
		url = "git@" + repo.host + ":" + repo.owner + "/" + repo.name + ".git";
	else
		url = addProtocol(repo.host) + "/" + repo.owner + "/" + repo.name + "/archive/" + repo.checkout + ".zip";

	return url
}

/**
 * Return a GitLab url for a given `repo` object.
 *
 * @param {Object} repo
 * @param {Boolean} [clone]
 * @return {String}
 */

function gitlab(repo, clone) {
	let url;

	if (clone)
		url = "git@" + repo.host + ":" + repo.owner + "/" + repo.name + ".git";
	else
		url = addProtocol(repo.host) + "/" + repo.owner + "/" + repo.name + "/repository/archive.zip?ref=" + repo.checkout;

	return url
}

/**
 * Return a Bitbucket url for a given `repo` object.
 *
 * @param {Object} repo
 * @param {Boolean} [clone]
 * @return {String}
 */

function bitbucket(repo, clone) {
	let url;

	if (clone)
		url = "git@" + repo.host + ":" + repo.owner + "/" + repo.name + ".git";
	else
		url = addProtocol(repo.host) + "/" + repo.owner + "/" + repo.name + "/get/" + repo.checkout + ".zip";

	return url
}

/**
 * Return a GitLab url for a given `repo` object.
 *
 * @param {Object} repo
 * @param {Boolean} [clone]
 * @return {Object}
 */

function oschina(repo, clone) {
	let url;

	// oschina canceled download directly
	clone = true;

	if (clone)
		url = addProtocol(repo.host) + "/" + repo.owner + "/" + repo.name;
		// url = "git@" + repo.host + ":" + repo.owner + "/" + repo.name + ".git";
	else
		url = addProtocol(repo.host) + "/" + repo.owner + "/" + repo.name + "/repository/archive/" + repo.checkout;

	return {url, clone}
}
