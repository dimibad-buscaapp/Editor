/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AgentClient } from './agentClient';

const INDEXABLE = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.py', '.go', '.rs', '.sql', '.css', '.html']);
const BATCH_SIZE = 8;
const MAX_FILES = 300;

export function registerWorkspaceIndexing(context: vscode.ExtensionContext, client: AgentClient): void {
	const autoIndex = () => {
		const enabled = vscode.workspace.getConfiguration('princyai').get<boolean>('workspaceIndex.onOpen', true);
		if (enabled && vscode.workspace.workspaceFolders?.length) {
			void indexWorkspace(client, false);
		}
	};

	context.subscriptions.push(
		vscode.commands.registerCommand('princyai.indexWorkspace', () => indexWorkspace(client, true))
	);

	setTimeout(autoIndex, 3000);
}

export async function indexWorkspace(client: AgentClient, showNotification: boolean): Promise<void> {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) {
		vscode.window.showWarningMessage('Abra um workspace para indexar.');
		return;
	}

	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: 'Princy Ai indexando workspace...',
			cancellable: true
		},
		async (progress, token) => {
			const files = await vscode.workspace.findFiles(
				'**/*',
				'{**/node_modules/**,**/.git/**,**/out/**,**/dist/**,**/.build/**,**/package-lock.json}',
				MAX_FILES
			);
			let done = 0;
			for (let i = 0; i < files.length; i += BATCH_SIZE) {
				if (token.isCancellationRequested) {
					break;
				}
				const batch = files.slice(i, i + BATCH_SIZE);
				const payload = [];
				for (const uri of batch) {
					const ext = uri.path.slice(uri.path.lastIndexOf('.')).toLowerCase();
					if (!INDEXABLE.has(ext)) {
						continue;
					}
					try {
						const doc = await vscode.workspace.openTextDocument(uri);
						if (doc.getText().length > 250_000) {
							continue;
						}
						payload.push({
							filePath: vscode.workspace.asRelativePath(uri, false),
							languageId: doc.languageId,
							content: doc.getText()
						});
					} catch {
						// skip
					}
				}
				if (payload.length > 0) {
					await client.indexFilesBatch(payload);
					done += payload.length;
				}
				progress.report({ message: `${done} / ${files.length} arquivos`, increment: (batch.length / files.length) * 100 });
			}
			if (showNotification) {
				vscode.window.showInformationMessage(`Princy Ai: ${done} arquivo(s) indexados.`);
			}
		}
	);
}
