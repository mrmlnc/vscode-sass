'use strict';

import * as path from 'path';

import { TextDocument, Files } from 'vscode-languageserver';
import { getSCSSLanguageService, SymbolKind, DocumentLink } from 'vscode-css-languageservice';

import { INode, NodeType } from '../types/nodes';
import { IDocument, ISymbols, IVariable, IImport } from '../types/symbols';
import { getNodeAtOffset, getParentNodeByType } from '../utils/ast';
import { ISettings } from '../types/settings';

// RegExp's
const reReferenceCommentGlobal = /\/\/\s*<reference\s*path=["'](.*)['"]\s*\/?>/g;
const reReferenceComment = /\/\/\s*<reference\s*path=["'](.*)['"]\s*\/?>/;
const reDynamicPath = /[#{}\*]/;

// SCSS Language Service
const ls = getSCSSLanguageService();

ls.configure({
	validate: false
});

/**
 * Returns all Symbols in a single document.
 */
export function parseDocument(document: TextDocument, offset: number = null, setting: ISettings): IDocument {
	const ast = ls.parseStylesheet(document) as INode;
	const documentPath = Files.uriToFilePath(document.uri) || document.uri;

	const symbols: ISymbols = {
		document: documentPath,
		filepath: documentPath,
		...findDocumentSymbols(document, ast, setting)
	};

	// Get `<reference *> comments from document
	const references = document.getText().match(reReferenceCommentGlobal);
	if (references) {
		references.forEach(x => {
			const filepath = reReferenceComment.exec(x)[1];
			symbols.imports.push({
				css: filepath.endsWith('.css'),
				dynamic: reDynamicPath.test(filepath),
				filepath: resolveReference(filepath, documentPath, setting),
				reference: true
			});
		});
	}

	return {
		node: getNodeAtOffset(ast, offset),
		symbols
	};
}

function findDocumentSymbols(document: TextDocument, ast: INode, setting: ISettings): ISymbols {
	const symbols = ls.findDocumentSymbols(document, ast);
	const links = findDocumentLinks(document, ast, setting);

	const result: ISymbols = {
		functions: [],
		imports: convertLinksToImports(links),
		mixins: [],
		variables: []
	};

	for (const symbol of symbols) {
		const position = symbol.location.range.start;
		const offset = document.offsetAt(symbol.location.range.start);

		if (symbol.kind === SymbolKind.Variable) {
			result.variables.push({
				name: symbol.name,
				offset,
				position,
				value: getVariableValue(ast, offset)
			});
		} else if (symbol.kind === SymbolKind.Method) {
			result.mixins.push({
				name: symbol.name,
				offset,
				position,
				parameters: getMethodParameters(ast, offset)
			});
		} else if (symbol.kind === SymbolKind.Function) {
			result.functions.push({
				name: symbol.name,
				offset,
				position,
				parameters: getMethodParameters(ast, offset)
			});
		}
	}

	return result;
}

function findDocumentLinks(document: TextDocument, ast: INode, setting: ISettings): DocumentLink[] {
	const links = ls.findDocumentLinks(document, ast, {
		resolveReference: (ref, base = Files.uriToFilePath(document.uri)) => resolveReference(ref, base, setting)
	});

	return links.map(link => ({
		...link,
		target: link.target.startsWith('file:') ? Files.uriToFilePath(link.target) : link.target
	}));
}

export function resolveReference(ref: string, base: string, setting: ISettings): string {
	let result = '';
	if (ref[0] === '~') {
		for (const alias of Object.keys(setting.aliasPaths)) {
			const prefix = `~${alias}`;
			if (ref.startsWith(prefix)) {
				result = path.join(setting.workspaceRoot, setting.aliasPaths[alias], ref.slice(prefix.length));
				break;
			}
		}
		if (result === '') {
			result = path.join(setting.workspaceRoot, 'node_modules', ref.slice(1));
		}
	}

	if (result === '') {
		result = path.join(path.dirname(base), ref);
	}

	if (!ref.endsWith('.scss') && !ref.endsWith('.css')) {
		result += '.scss';
	}

	return result;
}

function getVariableValue(ast: INode, offset: number): string | null {
	const node = getNodeAtOffset(ast, offset);

	if (node === null) {
		return null;
	}

	const parent = getParentNodeByType(node, NodeType.VariableDeclaration);

	return parent?.getValue()?.getText() || null;
}

function getMethodParameters(ast: INode, offset: number): IVariable[] {
	const node = getNodeAtOffset(ast, offset);

	if (node === null) {
		return [];
	}

	return node
		.getParameters()
		.getChildren()
		.map(child => {
			const defaultValueNode = child.getDefaultValue();

			const value = defaultValueNode === undefined ? null : defaultValueNode.getText();

			return {
				name: child.getName(),
				offset: child.offset,
				value
			};
		});
}

export function convertLinksToImports(links: DocumentLink[]): IImport[] {
	return links.map(link => ({
		filepath: link.target,
		dynamic: reDynamicPath.test(link.target),
		css: link.target.endsWith('.css')
	}));
}
