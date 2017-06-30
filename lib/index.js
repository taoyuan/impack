const Packer = require('./packer');

exports.Packer = Packer;
exports.packer = path => new Packer(path);
