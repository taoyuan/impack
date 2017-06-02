'use strict';

const pack = require('..').pack;
pack(__dirname).then(components => console.log(components));
