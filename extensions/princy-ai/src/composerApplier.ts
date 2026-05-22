/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/// <reference lib="dom" />

import * as vscode from 'vscode';
import { ComposerOperation, TerminalCommandResult } from './agentClient';
import { TerminalRunner } from './terminalRunner';

export interface ComposerApplyResult {
	readonly appliedFiles: readonly string[];
	readonly commandResults: readonly TerminalCommandResult[];
}

export class ComposerApplier {
	public constructor(private readonly terminalRunner: TerminalRunner) { }

	public async apply(operations: readonly ComposerOperation[]): Promise<ComposerApplyResult> {
		const appliedFiles: string[] = [];
		const commandResults: TerminalCommandResult[] = [];

		for (const operation of operations) {
			switch (operation.type) {
				case 'create':
					await writeText(resolveWorkspaceUri(operation.filePath), operation.content);
					appliedFiles.push(operation.filePath);
					break;
				case 'modify':
					await this.applyModify(operation);
					appliedFiles.push(operation.filePath);
					break;
				case 'delete':
					await vscode.workspace.fs.delete(resolveWorkspaceUri(operation.filePath), { recursive: false, useTrash: true });
					appliedFiles.push(operation.filePath);
					break;
				case 'runCommand':
					commandResults.push(await this.terminalRunner.run(operation.command));
					break;
			}
		}

		return {
			appliedFiles,
			commandResults
		};
	}

	private async applyModify(operation: Extract<ComposerOperation, { readonly type: 'modify' }>): Promise<void> {
		const uri = resolveWorkspaceUri(operation.filePath);
		if (operation.content !== undefined) {
			await writeText(uri, operation.content);
			return;
		}

		if (operation.search === undefined || operation.replace === undefined) {
			throw new Error(`Operacao modify invalida para ${operation.filePath}: informe content ou search/replace.`);
		}

		const current = await readText(uri);
		const next = current.replace(operation.search, operation.replace);
		if (next === current) {
			throw new Error(`SEARCH nao encontrado em ${operation.filePath}.`);
		}

		await writeText(uri, next);
	}
}

function resolveWorkspaceUri(filePath: string): vscode.Uri {
	if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(filePath)) {
		return vscode.Uri.parse(filePath);
	}

	const workspace = vscode.workspace.workspaceFolders?.[0];
	if (!workspace) {
		throw new Error('Nenhum workspace aberto para aplicar o Composer.');
	}

	const segments = filePath.split(/[\\/]/).filter(Boolean);
	return vscode.Uri.joinPath(workspace.uri, ...segments);
}

async function readText(uri: vscode.Uri): Promise<string> {
	return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
}

async function writeText(uri: vscode.Uri, content: string): Promise<void> {
	await ensureParentDirectory(uri);
	await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
}

async function ensureParentDirectory(uri: vscode.Uri): Promise<void> {
	const parentPath = uri.path.split('/').slice(0, -1).join('/') || '/';
	await vscode.workspace.fs.createDirectory(uri.with({ path: parentPath }));
}
