'use strict';

import * as assert from 'assert';

import { Hover } from 'vscode-languageserver';

import StorageService from '../../services/storage';
import { doHover } from '../../providers/hover';
import * as helpers from '../helpers';

const storage = new StorageService();

storage.set('file.scss', {
	document: 'file.scss',
	filepath: 'file.scss',
	variables: [
		{ name: '$variable', value: null, offset: 0, position: { line: 1, character: 1 } }
	],
	mixins: [
		{ name: 'mixin', parameters: [], offset: 0, position: { line: 1, character: 1 } }
	],
	functions: [
		{ name: 'make', parameters: [], offset: 0, position: { line: 1, character: 1 } }
	],
	imports: []
});

function getHover(lines: string[]): Hover | null {
	const text = lines.join('\n');

	const document = helpers.makeDocument(text);
	const settings = helpers.makeSettings();
	const offset = text.indexOf('|');

	return doHover(document, offset, settings, storage);
}

describe('Providers/Hover', () => {
	it('should suggest local symbols', () => {
		const actual = getHover([
			'$one: 1;',
			'.a { content: $one|; }'
		]);

		assert.deepStrictEqual(actual.contents, {
			language: 'scss',
			value: '$one: 1;'
		});
	});

	it('should suggest global variables', () => {
		const actual = getHover([
			'.a { content: $variable|; }'
		]);

		assert.deepStrictEqual(actual.contents, {
			language: 'scss',
			value: '$variable: null;\n@import "file.scss" (implicitly)'
		});
	});

	it('should suggest global mixins', () => {
		const actual = getHover([
			'@include mixin|'
		]);

		assert.deepStrictEqual(actual.contents, {
			language: 'scss',
			value: '@mixin mixin() {…}\n@import "file.scss" (implicitly)'
		});
	});

	// Does not work right now
	it.skip('should suggest global functions', () => {
		const actual = getHover([
			'.a { content: make|(); }'
		]);

		assert.deepStrictEqual(actual.contents, {
			language: 'scss',
			value: '@function make($a: null) {…}\n@import "file.scss" (implicitly)'
		});
	});
});
