/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

const MAX_RULES_CHARS = 32_000;

export async function loadPrincyRules(): Promise<string> {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) {
		return '';
	}

	const parts: string[] = [];

	const cursorRules = vscode.Uri.joinPath(folder.uri, '.cursorrules');
	const princyRule = vscode.Uri.joinPath(folder.uri, '.princyrule');
	const rulesDir = vscode.Uri.joinPath(folder.uri, '.princy', 'rules');

	for (const uri of [princyRule, cursorRules]) {
		const text = await readTextFile(uri);
		if (text) {
			parts.push(`# ${vscode.workspace.asRelativePath(uri, false)}\n${text}`);
		}
	}

	try {
		const entries = await vscode.workspace.fs.readDirectory(rulesDir);
		for (const [name, type] of entries) {
			if (type !== vscode.FileType.File || !name.endsWith('.md')) {
				continue;
			}
			const uri = vscode.Uri.joinPath(rulesDir, name);
			const text = await readTextFile(uri);
			if (text) {
				parts.push(`# .princy/rules/${name}\n${text}`);
			}
		}
	} catch {
		// rules dir optional
	}

	if (parts.length === 0) {
		return '';
	}

	return parts.join('\n\n---\n\n').slice(0, MAX_RULES_CHARS);
}

async function readTextFile(uri: vscode.Uri): Promise<string | undefined> {
	try {
		const bytes = await vscode.workspace.fs.readFile(uri);
		return new TextDecoder().decode(bytes).trim();
	} catch {
		return undefined;
	}
}

export async function ensurePrincyRulesTemplate(): Promise<void> {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) {
		return;
	}
	const example = vscode.Uri.joinPath(folder.uri, '.princy', 'rules', 'default.md');
	try {
		await vscode.workspace.fs.stat(example);
		return;
	} catch {
		// create template
	}
	const dir = vscode.Uri.joinPath(folder.uri, '.princy', 'rules');
	await vscode.workspace.fs.createDirectory(dir);
	const template = [
		'# Regras do projeto Princy Ai',
		'',
		'- Responda em portugues quando o usuario escrever em portugues.',
		'- Prefira TypeScript estrito e codigo simples.',
		'- Nao exponha segredos ou chaves de API.',
		''
	].join('\n');
	await vscode.workspace.fs.writeFile(example, new TextEncoder().encode(template));
}
