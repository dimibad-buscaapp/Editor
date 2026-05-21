/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ComposerOperation } from './agentClient';

export async function previewComposerOperation(operation: ComposerOperation): Promise<void> {
	if (operation.type === 'runCommand' || operation.type === 'delete') {
		vscode.window.showInformationMessage(
			operation.type === 'runCommand'
				? `Comando: ${operation.command}`
				: `Arquivo marcado para exclusao: ${operation.filePath}`
		);
		return;
	}

	const uri = resolveWorkspaceUri(operation.filePath);
	const languageId = inferLanguageId(operation.filePath);
	let modified: string;

	if (operation.type === 'create') {
		const original = await vscode.workspace.openTextDocument({ language: languageId, content: '' });
		const proposed = await vscode.workspace.openTextDocument({ language: languageId, content: operation.content });
		await vscode.commands.executeCommand(
			'vscode.diff',
			original.uri,
			proposed.uri,
			`Princy Ai: criar ${basename(operation.filePath)}`
		);
		return;
	}

	const current = await readText(uri);
	if (operation.content !== undefined) {
		modified = operation.content;
	} else if (operation.search !== undefined && operation.replace !== undefined) {
		modified = current.replace(operation.search, operation.replace);
		if (modified === current) {
			vscode.window.showWarningMessage(`SEARCH nao encontrado em ${operation.filePath}.`);
			return;
		}
	} else {
		vscode.window.showWarningMessage('Operacao modify sem conteudo para preview.');
		return;
	}

	const proposed = await vscode.workspace.openTextDocument({ language: languageId, content: modified });
	await vscode.commands.executeCommand(
		'vscode.diff',
		uri,
		proposed.uri,
		`Princy Ai: ${basename(operation.filePath)}`
	);
}

function resolveWorkspaceUri(filePath: string): vscode.Uri {
	if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(filePath)) {
		return vscode.Uri.parse(filePath);
	}

	const workspace = vscode.workspace.workspaceFolders?.[0];
	if (!workspace) {
		throw new Error('Nenhum workspace aberto para preview.');
	}

	const segments = filePath.split(/[\\/]/).filter(Boolean);
	return vscode.Uri.joinPath(workspace.uri, ...segments);
}

async function readText(uri: vscode.Uri): Promise<string> {
	try {
		return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
	} catch {
		return '';
	}
}

function basename(filePath: string): string {
	const parts = filePath.split(/[\\/]/).filter(Boolean);
	return parts[parts.length - 1] ?? filePath;
}

function inferLanguageId(filePath: string): string {
	const ext = filePath.split('.').pop()?.toLowerCase();
	switch (ext) {
		case 'ts':
		case 'tsx':
			return 'typescript';
		case 'js':
		case 'jsx':
			return 'javascript';
		case 'json':
			return 'json';
		case 'md':
			return 'markdown';
		case 'py':
			return 'python';
		case 'css':
			return 'css';
		case 'html':
			return 'html';
		default:
			return 'plaintext';
	}
}
