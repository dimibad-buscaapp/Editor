/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AgentClient, AgentModel } from './agentClient';

type WebviewMessage =
	| { readonly type: 'sendMessage'; readonly text: string; readonly agent: AgentModel }
	| { readonly type: 'indexActiveFile' }
	| { readonly type: 'runCommand'; readonly command: string };

export class PrincyChatViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'princyai.chat';
	private view: vscode.WebviewView | undefined;

	public constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly client: AgentClient,
		private readonly indexActiveFile: () => Promise<void>,
		private readonly runSuggestedCommand: (command?: string) => Promise<void>
	) { }

	public resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.extensionUri]
		};
		webviewView.webview.html = this.getHtml(webviewView.webview);
		webviewView.webview.onDidReceiveMessage(message => this.handleMessage(message as WebviewMessage));
	}

	public async focus(): Promise<void> {
		await vscode.commands.executeCommand('workbench.view.extension.princyai');
		this.view?.webview.postMessage({ type: 'focusInput' });
	}

	private async handleMessage(message: WebviewMessage): Promise<void> {
		switch (message.type) {
			case 'sendMessage':
				await this.sendChatMessage(message.text, message.agent);
				break;
			case 'indexActiveFile':
				await this.indexActiveFile();
				this.view?.webview.postMessage({ type: 'status', text: 'Arquivo ativo indexado.' });
				break;
			case 'runCommand':
				await this.runSuggestedCommand(message.command);
				break;
		}
	}

	private async sendChatMessage(text: string, agent: AgentModel): Promise<void> {
		if (!text.trim()) {
			return;
		}

		const editor = vscode.window.activeTextEditor;
		const selectedText = editor && !editor.selection.isEmpty ? editor.document.getText(editor.selection) : undefined;
		this.view?.webview.postMessage({ type: 'append', role: 'user', text });
		this.view?.webview.postMessage({ type: 'status', text: 'Consultando Princy Ai...' });

		try {
			const response = await this.client.chat({
				agent,
				message: text,
				filePath: editor?.document.uri.toString(),
				selectedText
			});
			this.view?.webview.postMessage({
				type: 'append',
				role: 'assistant',
				text: response.message,
				suggestedCommands: response.suggestedCommands ?? []
			});
			this.view?.webview.postMessage({ type: 'status', text: '' });
		} catch (error) {
			this.view?.webview.postMessage({ type: 'status', text: error instanceof Error ? error.message : 'Falha ao consultar a IA.' });
		}
	}

	private getHtml(webview: vscode.Webview): string {
		const nonce = getNonce();
		return /* html */`<!DOCTYPE html>
<html lang="pt-BR">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
	<title>Princy Ai</title>
	<style>
		body { color: var(--vscode-foreground); font-family: var(--vscode-font-family); padding: 12px; }
		.messages { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
		.message { border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 8px; white-space: pre-wrap; }
		.user { background: var(--vscode-input-background); }
		.assistant { background: var(--vscode-editor-background); }
		textarea { box-sizing: border-box; width: 100%; min-height: 90px; resize: vertical; }
		select { box-sizing: border-box; width: 100%; margin-bottom: 8px; }
		button { margin-top: 8px; margin-right: 6px; }
		.status { color: var(--vscode-descriptionForeground); min-height: 18px; }
		.label { color: var(--vscode-descriptionForeground); display: block; margin-bottom: 4px; }
	</style>
</head>
<body>
	<div class="messages" id="messages"></div>
	<div class="status" id="status"></div>
	<label class="label" for="agent">Agente IA</label>
	<select id="agent">
		<option value="princy">Princy Ai (recomendado)</option>
		<option value="deepseek">DeepSeek Coder local</option>
		<option value="qwen">Qwen Coder local</option>
		<option value="codellama">CodeLlama local</option>
		<option value="llama3">Llama 3.1 local</option>
		<option value="mistral">Mistral local</option>
		<option value="openai">OpenAI (requer chave)</option>
	</select>
	<textarea id="input" placeholder="Pergunte sobre o workspace ou use @arquivo..."></textarea>
	<div>
		<button id="send">Enviar</button>
		<button id="index">Indexar arquivo ativo</button>
	</div>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		const input = document.getElementById('input');
		const agent = document.getElementById('agent');
		const messages = document.getElementById('messages');
		const status = document.getElementById('status');

		document.getElementById('send').addEventListener('click', () => {
			vscode.postMessage({ type: 'sendMessage', text: input.value, agent: agent.value });
			input.value = '';
		});
		document.getElementById('index').addEventListener('click', () => {
			vscode.postMessage({ type: 'indexActiveFile' });
		});
		input.addEventListener('keydown', event => {
			if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
				vscode.postMessage({ type: 'sendMessage', text: input.value, agent: agent.value });
				input.value = '';
			}
		});

		window.addEventListener('message', event => {
			const message = event.data;
			if (message.type === 'focusInput') {
				input.focus();
			}
			if (message.type === 'status') {
				status.textContent = message.text || '';
			}
			if (message.type === 'append') {
				const item = document.createElement('div');
				item.className = 'message ' + message.role;
				item.textContent = (message.role === 'user' ? 'Você: ' : 'Princy Ai: ') + message.text;
				messages.appendChild(item);
				if (message.suggestedCommands) {
					for (const command of message.suggestedCommands) {
						const button = document.createElement('button');
						button.textContent = 'Run: ' + command;
						button.addEventListener('click', () => vscode.postMessage({ type: 'runCommand', command }));
						messages.appendChild(button);
					}
				}
			}
		});
	</script>
</body>
</html>`;
	}
}

function getNonce(): string {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
