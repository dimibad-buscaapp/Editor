/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AgentClient, AgentModel } from './agentClient';

const supportedLanguages = new Set([
	'typescript',
	'typescriptreact',
	'javascript',
	'javascriptreact',
	'python',
	'json',
	'jsonc',
	'markdown',
	'html',
	'css',
	'scss',
	'rust',
	'go',
	'java',
	'csharp',
	'php',
	'yaml',
	'sql',
	'shellscript',
	'powershell'
]);

export class PrincyGhostTextProvider implements vscode.InlineCompletionItemProvider {
	private requestGeneration = 0;

	public constructor(private readonly client: AgentClient) { }

	public provideInlineCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		context: vscode.InlineCompletionContext,
		token: vscode.CancellationToken
	): vscode.ProviderResult<vscode.InlineCompletionItem[]> {
		if (!this.isEnabled()) {
			return [];
		}

		if (!supportedLanguages.has(document.languageId)) {
			return [];
		}

		if (document.uri.scheme !== 'file' && document.uri.scheme !== 'vscode-remote') {
			return [];
		}

		const line = document.lineAt(position.line);
		if (line.isEmptyOrWhitespace && context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic) {
			return [];
		}

		const linePrefix = line.text.slice(0, position.character);
		if (context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic && linePrefix.trim().length < 2) {
			return [];
		}

		const debounceMs = vscode.workspace.getConfiguration('princyai').get<number>('ghostText.debounceMs', 650);
		const generation = ++this.requestGeneration;

		return new Promise<vscode.InlineCompletionItem[]>(resolve => {
			const timer = setTimeout(async () => {
				if (token.isCancellationRequested || generation !== this.requestGeneration) {
					resolve([]);
					return;
				}

				try {
					const prefixLines = vscode.workspace.getConfiguration('princyai').get<number>('ghostText.prefixLines', 36);
					const prefixStartLine = Math.max(0, position.line - prefixLines);
					const prefixRange = new vscode.Range(prefixStartLine, 0, position.line, position.character);
					const prefix = document.getText(prefixRange);
					const suffixEndLine = Math.min(document.lineCount - 1, position.line + 8);
					const suffixEnd = document.lineAt(suffixEndLine).range.end;
					const suffix = document.getText(new vscode.Range(position, suffixEnd)).slice(0, 1200);
					const agent = this.getAgent();

					const response = await this.client.inlineComplete({
						agent,
						filePath: document.uri.toString(),
						languageId: document.languageId,
						prefix,
						suffix,
						linePrefix
					});

					if (token.isCancellationRequested || generation !== this.requestGeneration) {
						resolve([]);
						return;
					}

					const completion = response.completion?.trimEnd();
					if (!completion) {
						resolve([]);
						return;
					}

					const item = new vscode.InlineCompletionItem(
						completion,
						new vscode.Range(position, position)
					);
					item.filterText = linePrefix + completion;
					resolve([item]);
				} catch {
					resolve([]);
				}
			}, debounceMs);

			token.onCancellationRequested(() => {
				clearTimeout(timer);
				resolve([]);
			});
		});
	}

	private isEnabled(): boolean {
		return vscode.workspace.getConfiguration('princyai').get<boolean>('ghostText.enabled', true);
	}

	private getAgent(): AgentModel {
		return vscode.workspace.getConfiguration('princyai').get<AgentModel>('ghostText.agent', 'princy');
	}
}

export function registerPrincyGhostText(context: vscode.ExtensionContext, client: AgentClient): void {
	const provider = new PrincyGhostTextProvider(client);
	const selector: vscode.DocumentSelector = [
		{ scheme: 'file' },
		{ scheme: 'vscode-remote' }
	];

	context.subscriptions.push(
		vscode.languages.registerInlineCompletionItemProvider(selector, provider)
	);
}
