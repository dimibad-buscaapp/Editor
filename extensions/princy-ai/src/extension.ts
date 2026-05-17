/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AgentClient } from './agentClient';
import { PrincyChatViewProvider } from './chatView';

const output = vscode.window.createOutputChannel('Princy Ai');

export function activate(context: vscode.ExtensionContext): void {
	const client = new AgentClient();
	const provider = new PrincyChatViewProvider(
		context.extensionUri,
		client,
		() => indexActiveFile(client),
		command => runSuggestedCommand(command)
	);

	context.subscriptions.push(
		output,
		vscode.window.registerWebviewViewProvider(PrincyChatViewProvider.viewType, provider, {
			webviewOptions: {
				retainContextWhenHidden: true
			}
		}),
		vscode.commands.registerCommand('princyai.inlineEdit', () => inlineEdit(client)),
		vscode.commands.registerCommand('princyai.chat.focus', () => provider.focus()),
		vscode.commands.registerCommand('princyai.indexActiveFile', () => indexActiveFile(client)),
		vscode.commands.registerCommand('princyai.runSuggestedCommand', command => runSuggestedCommand(command)),
		vscode.workspace.onDidSaveTextDocument(document => {
			const autoIndex = vscode.workspace.getConfiguration('princyai').get<boolean>('autoIndexOnSave', true);
			if (autoIndex) {
				indexDocument(client, document).catch(error => output.appendLine(formatError(error)));
			}
		})
	);
}

export function deactivate(): void {
	// Noop
}

async function inlineEdit(client: AgentClient): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showWarningMessage('Abra um arquivo antes de usar o Princy Ai.');
		return;
	}

	if (editor.selection.isEmpty) {
		vscode.window.showWarningMessage('Selecione o código que a IA deve editar.');
		return;
	}

	const instruction = await vscode.window.showInputBox({
		title: 'Princy Ai Inline Edit',
		placeHolder: 'Ex: refatore, corrija bug, adicione validação...',
		prompt: 'Descreva a alteração que deve ser aplicada à seleção.'
	});

	if (!instruction) {
		return;
	}

	const selection = editor.selection;
	const selectedText = editor.document.getText(selection);

	await vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: 'Princy Ai gerando edição...',
		cancellable: false
	}, async () => {
		const response = await client.inlineEdit({
			instruction,
			selectedText,
			languageId: editor.document.languageId,
			filePath: editor.document.uri.toString()
		});

		const action = await vscode.window.showInformationMessage(
			response.explanation ?? 'Princy Ai gerou uma substituição para a seleção.',
			{ modal: true },
			'Aplicar',
			'Ver Preview',
			'Cancelar'
		);

		if (action === 'Ver Preview') {
			const document = await vscode.workspace.openTextDocument({
				language: editor.document.languageId,
				content: response.replacement
			});
			await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
			const applyAfterPreview = await vscode.window.showInformationMessage('Aplicar esta substituição no arquivo original?', { modal: true }, 'Aplicar', 'Cancelar');
			if (applyAfterPreview !== 'Aplicar') {
				return;
			}
		} else if (action !== 'Aplicar') {
			return;
		}

		await editor.edit(editBuilder => {
			editBuilder.replace(selection, response.replacement);
		});
		await editor.document.save();
	});
}

async function indexActiveFile(client: AgentClient): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showWarningMessage('Abra um arquivo para indexar.');
		return;
	}

	await vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: 'Princy Ai indexando arquivo...',
		cancellable: false
	}, async () => {
		await indexDocument(client, editor.document);
	});

	vscode.window.showInformationMessage('Arquivo indexado pelo Princy Ai.');
}

async function indexDocument(client: AgentClient, document: vscode.TextDocument): Promise<void> {
	if (document.uri.scheme !== 'file' && document.uri.scheme !== 'vscode-remote') {
		return;
	}

	await client.indexFile({
		filePath: document.uri.toString(),
		languageId: document.languageId,
		content: document.getText()
	});
}

async function runSuggestedCommand(command?: string): Promise<void> {
	const value = command ?? await vscode.window.showInputBox({
		title: 'Princy Ai Run Command',
		placeHolder: 'npm install pacote',
		prompt: 'Comando a executar no terminal integrado.'
	});

	if (!value) {
		return;
	}

	const action = await vscode.window.showWarningMessage(`Executar comando no terminal?\n\n${value}`, { modal: true }, 'Run', 'Cancelar');
	if (action !== 'Run') {
		return;
	}

	const terminal = vscode.window.createTerminal({ name: 'Princy Ai' });
	terminal.show();
	terminal.sendText(value);
}

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
