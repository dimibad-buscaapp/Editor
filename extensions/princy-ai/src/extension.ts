/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AgentClient } from './agentClient';
import type { AgentModel, ComposerPlan, TerminalCommandResult } from './agentClient';
import { PrincyChatViewProvider } from './chatView';
import { collectCodeGraphContext } from './codeGraph';
import { ComposerApplier } from './composerApplier';
import { previewComposerOperation } from './composerDiffPreview';
import { collectNativeContext } from './nativeContext';
import { ShadowContextManager } from './shadowContext';
import { registerPrincyGhostText } from './ghostTextProvider';
import { registerPrincyThemeOnActivate } from './princyTheme';
import { ensurePrincyRulesTemplate } from './princyRules';
import { registerWorkspaceIndexing } from './workspaceIndexService';
import { registerPrincyWorkbenchUi } from './workbenchUi';
import { registerPrincyChatIsolation } from './princyChatIsolation';
import { registerPrincyDefaultChat } from './princyWorkbenchChat';
import { checkAgentBackend } from './agentConnectivity';
import { TerminalRunner } from './terminalRunner';

const output = vscode.window.createOutputChannel('Princy Ai');

export function activate(context: vscode.ExtensionContext): void {
	output.appendLine('Activating Princy Ai extension.');
	const client = new AgentClient();
	void client.resolveEndpoint().then(endpoint => {
		output.appendLine(`Agent API endpoint: ${endpoint}`);
	});
	const shadowContext = new ShadowContextManager();
	const terminalRunner = new TerminalRunner();
	const composerApplier = new ComposerApplier(terminalRunner);
	const provider = new PrincyChatViewProvider(
		context.extensionUri,
		client,
		() => indexActiveFile(client),
		command => runSuggestedCommand(terminalRunner, shadowContext, command),
		() => collectNativeContext(shadowContext.getSnapshot()),
		async (plan, operationIds, instruction, agent) => {
			const selectedOperations = plan.operations.filter(operation => operationIds.includes(operation.id));
			const result = await composerApplier.apply(selectedOperations);
			for (const commandResult of result.commandResults) {
				shadowContext.setLastTerminalResult(commandResult);
			}
			const failedCommand = result.commandResults.find(commandResult => commandResult.exitCode !== undefined && commandResult.exitCode !== 0);
			const repairPlan = failedCommand
				? await client.repairAfterCommand({
					agent,
					originalInstruction: instruction,
					previousPlan: plan,
					commandResult: failedCommand,
					shadowContext: shadowContext.getSnapshot(),
					codeGraph: await collectCodeGraphContext()
				})
				: undefined;
			return {
				appliedFiles: result.appliedFiles,
				commandResults: result.commandResults,
				repairPlan
			};
		},
		code => insertCodeAtCursor(code),
		code => applyCodeToFile(code),
		operation => previewComposerOperation(operation)
	);

	context.subscriptions.push(
		output,
		shadowContext,
		vscode.window.registerWebviewViewProvider(PrincyChatViewProvider.viewType, provider, {
			webviewOptions: {
				retainContextWhenHidden: true
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('princyai.inlineEdit', () => inlineEdit(client, shadowContext)),
		vscode.commands.registerCommand('princyai.composer', () => provider.focusComposer()),
		vscode.commands.registerCommand('princyai.open', () => provider.focus()),
		vscode.commands.registerCommand('princyai.chat.focus', () => provider.focus()),
		vscode.commands.registerCommand('princyai.native.collectContext', () => collectNativeContext(shadowContext.getSnapshot())),
		vscode.commands.registerCommand('princyai.indexActiveFile', () => indexActiveFile(client)),
		vscode.commands.registerCommand('princyai.runSuggestedCommand', command => runSuggestedCommand(terminalRunner, shadowContext, command)),
		vscode.commands.registerCommand('princyai.reconnectBackend', async () => {
			client.clearEndpointCache();
			const endpoint = await client.resolveEndpoint();
			const status = await checkAgentBackend(client);
			const msg = status.online
				? `Princy API online: ${endpoint}`
				: `Princy API offline em ${endpoint}. ${status.message}`;
			if (status.online) {
				void vscode.window.showInformationMessage(msg);
			} else {
				void vscode.window.showErrorMessage(msg, { modal: false });
			}
			output.appendLine(msg);
		}),
		vscode.workspace.onDidSaveTextDocument(document => {
			const autoIndex = vscode.workspace.getConfiguration('princyai').get<boolean>('autoIndexOnSave', true);
			if (autoIndex) {
				indexDocument(client, document).catch(error => output.appendLine(formatError(error)));
			}
		})
	);

	registerTerminalFixLinks(context, provider);
	registerPrincyGhostText(context, client);
	registerPrincyThemeOnActivate(context);
	registerWorkspaceIndexing(context, client);
	registerPrincyWorkbenchUi(context);
	registerPrincyDefaultChat(context);
	registerPrincyChatIsolation(context);
	void ensurePrincyRulesTemplate();

	output.appendLine('Princy Ai view provider registered.');
}

export function deactivate(): void {
	// Noop
}

async function inlineEdit(client: AgentClient, shadowContext: ShadowContextManager): Promise<void> {
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
	const agent = await pickAgent();
	if (!agent) {
		return;
	}

	await vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: 'Princy Ai gerando edição...',
		cancellable: false
	}, async () => {
		const nativeContext = await collectNativeContext({
			...shadowContext.getSnapshot(),
			activeFilePath: editor.document.uri.toString(),
			activeLanguageId: editor.document.languageId,
			activeContent: editor.document.getText(),
			activeSelection: selectedText
		});
		const response = await client.inlineEdit({
			agent,
			instruction,
			selectedText,
			languageId: editor.document.languageId,
			filePath: editor.document.uri.toString(),
			shadowContext: nativeContext.shadowContext,
			codeGraph: nativeContext.codeGraph
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

async function runSuggestedCommand(terminalRunner: TerminalRunner, shadowContext: ShadowContextManager, command?: string): Promise<void> {
	const value = command ?? await vscode.window.showInputBox({
		title: 'Princy Ai Run Command',
		placeHolder: 'npm install pacote',
		prompt: 'Comando a executar no terminal integrado.'
	});

	if (!value) {
		return;
	}

	const result = await terminalRunner.run(value);
	shadowContext.setLastTerminalResult(result);
}

async function insertCodeAtCursor(code: string): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showWarningMessage('Abra um arquivo antes de inserir codigo.');
		return;
	}

	await editor.edit(editBuilder => {
		editBuilder.insert(editor.selection.active, code);
	});
}

async function applyCodeToFile(code: string): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showWarningMessage('Abra o arquivo de destino antes de aplicar codigo.');
		return;
	}

	const action = await vscode.window.showWarningMessage(
		`Substituir todo o conteudo de ${editor.document.uri.toString()} pelo bloco sugerido?`,
		{ modal: true },
		'Apply',
		'Cancelar'
	);
	if (action !== 'Apply') {
		return;
	}

	const fullRange = new vscode.Range(
		editor.document.positionAt(0),
		editor.document.positionAt(editor.document.getText().length)
	);
	await editor.edit(editBuilder => {
		editBuilder.replace(fullRange, code);
	});
	await editor.document.save();
}

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function registerTerminalFixLinks(context: vscode.ExtensionContext, provider: PrincyChatViewProvider): void {
	if (!vscode.window.registerTerminalLinkProvider) {
		output.appendLine('Terminal link provider unavailable in this host.');
		return;
	}

	import('./terminalFixLinkProvider')
		.then(({ PrincyTerminalLinkProvider }) => {
			context.subscriptions.push(vscode.window.registerTerminalLinkProvider(new PrincyTerminalLinkProvider(errorText => provider.fixTerminalError(errorText))));
			output.appendLine('Princy terminal fix links registered.');
		})
		.then(undefined, error => output.appendLine(`Terminal fix links disabled: ${formatError(error)}`));
}

export interface ComposerApplyResponse {
	readonly appliedFiles: readonly string[];
	readonly commandResults: readonly TerminalCommandResult[];
	readonly repairPlan?: ComposerPlan;
}

async function pickAgent(): Promise<AgentModel | undefined> {
	const selected = await vscode.window.showQuickPick([
		{ label: 'Princy Ai DeepSeek', description: 'Principal, codigo eficiente, local via Ollama', value: 'deepseek' },
		{ label: 'Princy Ai', description: 'Marca principal usando DeepSeek Coder', value: 'princy' },
		{ label: 'Qwen Coder', description: 'Contexto complexo, local via Ollama', value: 'qwen' },
		{ label: 'CodeLlama', description: 'Programacao pratica, local via Ollama', value: 'codellama' },
		{ label: 'Llama 3.1', description: 'Uso geral, local via Ollama', value: 'llama3' },
		{ label: 'Mistral', description: 'Rapido e conciso, local via Ollama', value: 'mistral' },
		{ label: 'OpenAI', description: 'Opcional, requer chave de API', value: 'openai' },
	] satisfies Array<vscode.QuickPickItem & { value: AgentModel }>, {
		title: 'Escolha o agente IA'
	});

	return selected?.value;
}
