import { getDocUri, showFile, position, sleep } from '../util';
import { testCompletion } from './helper';

describe('SCSS Completion Test', () => {
	const docUri = getDocUri('completion/main.scss');

	before(async () => {
		await showFile(docUri);
		await sleep(2000);
	});

	it('Offers variable completions', async () => {
		await testCompletion(docUri, position(5, 11), ['$color', '$fonts']);
	});

	it('Offers completions from tilde imports', async () => {
		await testCompletion(docUri, position(11, 11), [{ label: '$tilde', detail: 'node_modules/foo/bar.scss' }]);
	});

	it('Offers completions from tilde imports on top node_modules', async () => {
		await testCompletion(docUri, position(23, 11), [{ label: '$yellow', detail: '../node_modules/oao/foo.scss' }]);
	});

	it('Offers completions from partial file', async () => {
		await testCompletion(docUri, position(17, 11), [{ label: '$partial', detail: 'partial.scss' }]);
	});

	it('Offers completions from alias file', async () => {
		await testCompletion(docUri, position(29, 11), [{ label: '$black', detail: '../src/color.scss' }]);
	});
});
