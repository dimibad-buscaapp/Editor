/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CodeGraphContext } from './agentClient';

const MAX_ITEMS = 30;

export async function collectCodeGraphContext(): Promise<CodeGraphContext> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return {
			symbols: [],
			definitions: [],
			references: []
		};
	}

	const document = editor.document;
	const position = editor.selection.active;
	const [symbols, definitions, references] = await Promise.all([
		collectSymbols(document.uri),
		collectLocations('vscode.executeDefinitionProvider', document.uri, position),
		collectLocations('vscode.executeReferenceProvider', document.uri, position)
	]);

	return {
		symbols,
		definitions,
		references
	};
}

async function collectSymbols(uri: vscode.Uri): Promise<string[]> {
	const result = await vscode.commands.executeCommand<Array<vscode.DocumentSymbol | vscode.SymbolInformation>>('vscode.executeDocumentSymbolProvider', uri);
	if (!result) {
		return [];
	}

	const output: string[] = [];
	for (const item of result) {
		appendSymbol(item, output, '');
	}
	return output.slice(0, MAX_ITEMS);
}

function appendSymbol(symbol: vscode.DocumentSymbol | vscode.SymbolInformation, output: string[], prefix: string): void {
	if ('children' in symbol) {
		const name = `${prefix}${symbol.name}`;
		output.push(`${vscode.SymbolKind[symbol.kind]} ${name}`);
		for (const child of symbol.children) {
			appendSymbol(child, output, `${name}.`);
		}
		return;
	}

	output.push(`${vscode.SymbolKind[symbol.kind]} ${symbol.name} ${symbol.location?.uri?.toString() ?? ''}`);
}

async function collectLocations(command: string, uri: vscode.Uri, position: vscode.Position): Promise<string[]> {
	const result = await vscode.commands.executeCommand<Array<vscode.Location | vscode.LocationLink>>(command, uri, position);
	if (!result) {
		return [];
	}

	return result.map(item => {
		if ('targetUri' in item) {
			return `${item.targetUri.toString()}:${item.targetRange.start.line + 1}`;
		}
		return `${item.uri?.toString() ?? ''}:${item.range.start.line + 1}`;
	}).slice(0, MAX_ITEMS);
}
