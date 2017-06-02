/**
 * impack
 *
 * Copyright © 2016 Yuan Tao. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const {assert} = require('chai');
const path = require('path');
const utils = require('../src/utils');

describe('utils', () => {
	it('#resolveComponents', function () {
		const resolved = utils.resolveComponents({
			a: 'a',
			b: {
				c: {
					d: {
						e: 'e',
						f: 'f'
					},
					g: 'g'
				},
				h: 'h'
			},
			i: 'i'
		});
		assert.deepEqual(resolved, {
			a: 'a',
			'b/c/d/e': 'e',
			'b/c/d/f': 'f',
			'b/c/g': 'g',
			'b/h': 'h',
			'i': 'i',
		})
	});
});
