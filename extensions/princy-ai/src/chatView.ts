/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AgentClient, AgentDefinition, AgentModel, ComposerPlan, TerminalCommandResult } from './agentClient';
import type { NativeContextBundle } from './nativeContext';

type ModelSegment = 'LOGIC' | 'FRONTEND' | 'BACKEND' | 'DEBUG';

type WebviewMessage =
	| { readonly type: 'sendMessage'; readonly text: string; readonly agent: AgentModel; readonly force_segment?: ModelSegment; readonly priority?: 'normal' | 'high' }
	| { readonly type: 'requestComposer'; readonly text: string; readonly agent: AgentModel }
	| { readonly type: 'applyComposerPlan'; readonly instruction: string; readonly agent: AgentModel; readonly plan: ComposerPlan; readonly operationIds: readonly string[] }
	| { readonly type: 'insertCode'; readonly code: string }
	| { readonly type: 'applyCodeToFile'; readonly code: string }
	| { readonly type: 'indexActiveFile' }
	| { readonly type: 'runCommand'; readonly command: string };

type ApplyComposerPlan = (
	plan: ComposerPlan,
	operationIds: readonly string[],
	instruction: string,
	agent: AgentModel
) => Promise<{
	readonly appliedFiles: readonly string[];
	readonly commandResults: readonly TerminalCommandResult[];
	readonly repairPlan?: ComposerPlan;
}>;

export class PrincyChatViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'princyai.chat';
	private view: vscode.WebviewView | undefined;

	public constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly client: AgentClient,
		private readonly indexActiveFile: () => Promise<void>,
		private readonly runSuggestedCommand: (command?: string) => Promise<void>,
		private readonly collectNativeContext: () => Promise<NativeContextBundle>,
		private readonly applyComposerPlan: ApplyComposerPlan,
		private readonly insertCodeAtCursor: (code: string) => Promise<void>,
		private readonly applyCodeToFile: (code: string) => Promise<void>
	) { }

	public resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.extensionUri]
		};
		webviewView.webview.html = this.getHtml(webviewView.webview);
		webviewView.webview.onDidReceiveMessage(message => this.handleMessage(message as WebviewMessage));
		this.refreshAgents();
	}

	public async focus(): Promise<void> {
		await vscode.commands.executeCommand('workbench.view.extension.princyai');
		this.view?.webview.postMessage({ type: 'focusInput' });
	}

	public async focusComposer(): Promise<void> {
		await vscode.commands.executeCommand('workbench.view.extension.princyai');
		this.view?.webview.postMessage({ type: 'focusComposer' });
	}

	public async fixTerminalError(errorText: string): Promise<void> {
		await vscode.commands.executeCommand('workbench.view.extension.princyai');
		const prompt = [
			'O usuario encontrou este erro no terminal:',
			errorText,
			'Analise o contexto atual, encontre a causa provavel e gere uma correcao imediata.'
		].join('\n\n');
		this.view?.webview.postMessage({ type: 'prefillComposer', text: prompt });
		await this.requestComposerPlan(prompt, 'deepseek');
	}

	private async handleMessage(message: WebviewMessage): Promise<void> {
		switch (message.type) {
			case 'sendMessage':
				await this.sendChatMessage(message.text, message.agent, message.force_segment, message.priority);
				break;
			case 'requestComposer':
				await this.requestComposerPlan(message.text, message.agent);
				break;
			case 'applyComposerPlan':
				await this.applyComposer(message.plan, message.operationIds, message.instruction, message.agent);
				break;
			case 'insertCode':
				await this.insertCodeAtCursor(message.code);
				break;
			case 'applyCodeToFile':
				await this.applyCodeToFile(message.code);
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

	private async refreshAgents(): Promise<void> {
		try {
			const models = await this.client.models();
			this.view?.webview.postMessage({ type: 'agents', models });
		} catch (error) {
			this.view?.webview.postMessage({
				type: 'status',
				text: `Usando lista local de agentes. Backend nao respondeu /api/agent/models: ${error instanceof Error ? error.message : 'erro desconhecido'}`
			});
			this.view?.webview.postMessage({ type: 'agents', models: defaultAgents });
		}
	}

	private async requestComposerPlan(text: string, agent: AgentModel): Promise<void> {
		if (!text.trim()) {
			return;
		}

		this.view?.webview.postMessage({ type: 'append', role: 'user', text: `Composer: ${text}` });
		this.view?.webview.postMessage({ type: 'thinking', steps: [
			{ label: 'Analisando arquivos...', state: 'done' },
			{ label: 'Lendo contexto do terminal...', state: 'active' },
			{ label: 'Gerando diff de alteracao...', state: 'pending' },
			{ label: 'Aguardando aprovacao...', state: 'pending' }
		] });
		try {
			const nativeContext = await this.collectNativeContext();
			const plan = await this.client.composerPlan({
				agent,
				instruction: text,
				shadowContext: nativeContext.shadowContext,
				codeGraph: nativeContext.codeGraph
			});
			this.view?.webview.postMessage({ type: 'thinking', steps: [
				{ label: 'Analisando arquivos...', state: 'done' },
				{ label: 'Lendo contexto do terminal...', state: 'done' },
				{ label: 'Gerando diff de alteracao...', state: 'done' },
				{ label: 'Aguardando aprovacao...', state: 'active' }
			] });
			this.view?.webview.postMessage({ type: 'composerPlan', instruction: text, agent, plan });
			this.view?.webview.postMessage({ type: 'status', text: '' });
		} catch (error) {
			this.view?.webview.postMessage({ type: 'status', text: error instanceof Error ? error.message : 'Falha ao gerar plano Composer.' });
		}
	}

	private async applyComposer(plan: ComposerPlan, operationIds: readonly string[], instruction: string, agent: AgentModel): Promise<void> {
		if (operationIds.length === 0) {
			this.view?.webview.postMessage({ type: 'status', text: 'Nenhuma operacao selecionada.' });
			return;
		}

		this.view?.webview.postMessage({ type: 'thinking', steps: [
			{ label: 'Validando selecao...', state: 'done' },
			{ label: 'Aplicando mudancas...', state: 'active' },
			{ label: 'Executando verificacoes...', state: 'pending' },
			{ label: 'Preparando reparo se necessario...', state: 'pending' }
		] });
		try {
			const result = await this.applyComposerPlan(plan, operationIds, instruction, agent);
			this.view?.webview.postMessage({
				type: 'append',
				role: 'assistant',
				text: [
					`Composer aplicado em ${result.appliedFiles.length} arquivo(s).`,
					...result.commandResults.map(commandResult => `Comando: ${commandResult.command}\nExit code: ${commandResult.exitCode ?? 'desconhecido'}`)
				].join('\n\n')
			});
			if (result.repairPlan) {
				this.view?.webview.postMessage({ type: 'composerPlan', instruction: `${instruction}\n\nCorrigir falha de verificacao.`, agent, plan: result.repairPlan });
			}
			this.view?.webview.postMessage({ type: 'thinking', steps: [
				{ label: 'Validando selecao...', state: 'done' },
				{ label: 'Aplicando mudancas...', state: 'done' },
				{ label: 'Executando verificacoes...', state: result.commandResults.length ? 'done' : 'pending' },
				{ label: result.repairPlan ? 'Reparo sugerido.' : 'Fluxo concluido.', state: 'done' }
			] });
			this.view?.webview.postMessage({ type: 'status', text: '' });
		} catch (error) {
			this.view?.webview.postMessage({ type: 'status', text: error instanceof Error ? error.message : 'Falha ao aplicar Composer.' });
		}
	}

	private async sendChatMessage(text: string, agent: AgentModel, forceSegment?: ModelSegment, priority: 'normal' | 'high' = 'normal'): Promise<void> {
		if (!text.trim()) {
			return;
		}

		const editor = vscode.window.activeTextEditor;
		const selectedText = editor && !editor.selection.isEmpty ? editor.document.getText(editor.selection) : undefined;
		const workspaceContext = vscode.workspace.workspaceFolders?.[0]?.name;
		const processingSegment = forceSegment ?? 'BACKEND';

		this.view?.webview.postMessage({ type: 'append', role: 'user', text });
		this.view?.webview.postMessage({
			type: 'intelligence_status',
			text: `[Princy IA] 🧠 Segmento: ${processingSegment} | Motor principal em execucao...`
		});
		this.view?.webview.postMessage({ type: 'thinking', steps: [
			{ label: 'Coletando Shadow Context...', state: 'done' },
			{ label: 'Orquestrando motores por segmento...', state: 'active' },
			{ label: 'Validando compilacao VPS...', state: 'pending' }
		] });

		try {
			const nativeContext = await this.collectNativeContext();
			const response = await this.client.chat({
				agent,
				message: text,
				context: workspaceContext,
				force_segment: forceSegment,
				priority,
				trigger_compile: priority === 'high',
				filePath: editor?.document.uri.toString(),
				selectedText,
				shadowContext: nativeContext.shadowContext,
				codeGraph: nativeContext.codeGraph
			});
			this.view?.webview.postMessage({
				type: 'append',
				role: 'assistant',
				text: response.content ?? response.message,
				suggestedCommands: response.suggestedCommands ?? []
			});
			this.view?.webview.postMessage({ type: 'thinking', steps: [
				{ label: 'Coletando Shadow Context...', state: 'done' },
				{ label: 'Orquestrando motores por segmento...', state: 'done' },
				{ label: 'Validando compilacao VPS...', state: 'done' }
			] });
			this.view?.webview.postMessage({
				type: 'intelligence_status',
				text: response.intelligence_status ?? this.formatMetadataStatus(response.metadata)
			});
			if (response.metadata?.compile_job_id) {
				this.pollCompileJob(response.metadata.compile_job_id);
			}
		} catch (error) {
			this.view?.webview.postMessage({
				type: 'intelligence_status',
				text: `[Princy IA] ❌ Falha | ${error instanceof Error ? error.message : 'Erro desconhecido'}`
			});
		}
	}

	private formatMetadataStatus(metadata: import('./agentClient').ChatMetadata): string {
		const engines = [metadata.primary_engine, ...metadata.fallback_engines].filter(Boolean).join(' ➔ ');
		if (metadata.phase === 'auto_healing') {
			return `[Princy IA] ⚠️ DEBUG | Auto-correcao aplicada | Motores: [${engines}] | ${metadata.execution_time}`;
		}
		if (metadata.vps_compile_status === 'READY') {
			return `[Princy IA] ✅ ${metadata.segment_used} | Motores: [${engines}] | ${metadata.execution_time} | Compiled & Ready`;
		}
		if (metadata.vps_compile_status === 'FAILED') {
			return `[Princy IA] ⚠️ ${metadata.segment_used} | Motores: [${engines}] | Compilador 3200 com pendencias`;
		}
		return `[Princy IA] ✅ ${metadata.segment_used} | Motores: [${engines}] | ${metadata.execution_time}`;
	}

	private async pollCompileJob(jobId: string): Promise<void> {
		for (let attempt = 0; attempt < 30; attempt++) {
			await new Promise(resolve => setTimeout(resolve, 2000));
			try {
				const status = await this.client.getCompileStatus(jobId);
				if (status.status === 'COMPILING') {
					this.view?.webview.postMessage({
						type: 'intelligence_status',
						text: `[Princy IA] ⚙️ Compilando no VPS (3200)... job ${jobId}`
					});
					continue;
				}
				if (status.status === 'READY') {
					this.view?.webview.postMessage({
						type: 'intelligence_status',
						text: `[Princy IA] ✅ Compilacao concluida | Code Web pronto`
					});
					return;
				}
				if (status.status === 'FAILED') {
					this.view?.webview.postMessage({
						type: 'intelligence_status',
						text: `[Princy IA] ⚠️ Compilacao falhou | Verifique logs do VPS`
					});
					return;
				}
			} catch {
				return;
			}
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
		body { background: #0d1117; color: var(--vscode-foreground); font-family: var(--vscode-font-family); padding: 12px; }
		.messages { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
		.message { border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 10px; white-space: pre-wrap; }
		.plan { border: 1px solid #7c3aed; border-radius: 8px; margin-bottom: 10px; padding: 10px; background: rgba(124, 58, 237, 0.08); }
		.operation { display: flex; align-items: flex-start; gap: 6px; margin: 6px 0; }
		.operation span { white-space: pre-wrap; }
		.diff { background: #05070a; border: 1px solid var(--vscode-panel-border); border-radius: 6px; font-family: var(--vscode-editor-font-family); margin-top: 6px; overflow: auto; padding: 6px; }
		.diff-line.add { color: #3fb950; }
		.diff-line.remove { color: #f85149; }
		.code-block { background: #05070a; border: 1px solid var(--vscode-panel-border); border-radius: 6px; margin: 8px 0; overflow: hidden; }
		.code-actions { background: rgba(124, 58, 237, 0.12); display: flex; gap: 6px; padding: 4px; }
		.code-block pre { margin: 0; overflow: auto; padding: 8px; }
		.thinking { border-left: 2px solid #7c3aed; color: var(--vscode-descriptionForeground); margin-bottom: 10px; padding-left: 8px; }
		.step.done { color: #3fb950; }
		.step.active { color: #8ab4ff; }
		.step.pending { opacity: 0.7; }
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
	<div class="thinking" id="thinking"></div>
	<div class="status" id="status"></div>
	<label class="label" for="segment">Segmento (force_segment)</label>
	<select id="segment">
		<option value="">Auto</option>
		<option value="LOGIC">LOGIC - Arquitetura</option>
		<option value="FRONTEND">FRONTEND - UI</option>
		<option value="BACKEND">BACKEND - API</option>
		<option value="DEBUG">DEBUG - Auditoria</option>
	</select>
	<label class="label" for="agent">Agente IA</label>
	<select id="agent">
		<option value="deepseek" selected>Princy Ai DeepSeek (principal)</option>
		<option value="princy">Princy Ai</option>
		<option value="qwen">Qwen Coder local</option>
		<option value="codellama">CodeLlama local</option>
		<option value="llama3">Llama 3.1 local</option>
		<option value="mistral">Mistral local</option>
		<option value="openai">OpenAI (requer chave)</option>
	</select>
	<textarea id="input" placeholder="Pergunte sobre o workspace ou use @arquivo..."></textarea>
	<div>
		<button id="send">Enviar</button>
		<button id="composer">Composer</button>
		<button id="index">Indexar arquivo ativo</button>
	</div>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		const input = document.getElementById('input');
		const agent = document.getElementById('agent');
		const segment = document.getElementById('segment');
		const messages = document.getElementById('messages');
		const status = document.getElementById('status');
		const thinking = document.getElementById('thinking');

		function postChatMessage(priority) {
			vscode.postMessage({
				type: 'sendMessage',
				text: input.value,
				agent: agent.value,
				force_segment: segment.value || undefined,
				priority: priority || 'normal'
			});
			input.value = '';
		}

		document.getElementById('send').addEventListener('click', () => postChatMessage('normal'));
		document.getElementById('composer').addEventListener('click', () => {
			vscode.postMessage({ type: 'requestComposer', text: input.value, agent: agent.value });
			input.value = '';
		});
		document.getElementById('index').addEventListener('click', () => {
			vscode.postMessage({ type: 'indexActiveFile' });
		});
		input.addEventListener('keydown', event => {
			if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
				postChatMessage('high');
			}
		});

		window.addEventListener('message', event => {
			const message = event.data;
			if (message.type === 'focusInput') {
				input.focus();
			}
			if (message.type === 'focusComposer') {
				input.placeholder = 'Descreva uma mudança multi-arquivo para o Composer...';
				input.focus();
			}
			if (message.type === 'status') {
				status.textContent = message.text || '';
			}
			if (message.type === 'intelligence_status') {
				status.textContent = message.text || '';
			}
			if (message.type === 'agents') {
				renderAgents(message.models || []);
			}
			if (message.type === 'thinking') {
				renderThinking(message.steps || []);
			}
			if (message.type === 'append') {
				const item = document.createElement('div');
				item.className = 'message ' + message.role;
				const prefix = document.createElement('strong');
				prefix.textContent = message.role === 'user' ? 'Você: ' : 'Princy Ai: ';
				item.appendChild(prefix);
				renderRichText(item, message.text);
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
			if (message.type === 'composerPlan') {
				renderComposerPlan(message.instruction, message.agent, message.plan);
			}
		});

		function renderAgents(models) {
			const selected = agent.value || 'deepseek';
			agent.innerHTML = '';
			for (const model of models) {
				const option = document.createElement('option');
				option.value = model.id;
				option.textContent = model.label + ' (' + model.modelName + ')' + (model.isLocal ? ' local' : ' externo');
				agent.appendChild(option);
			}
			if (Array.from(agent.options).some(option => option.value === selected)) {
				agent.value = selected;
			}
			if (!agent.value && agent.options.length > 0) {
				agent.value = agent.options[0].value;
			}
		}

		function renderComposerPlan(instruction, agentName, plan) {
			const wrapper = document.createElement('div');
			wrapper.className = 'plan';

			const title = document.createElement('strong');
			title.textContent = 'Composer: ' + plan.summary;
			wrapper.appendChild(title);

			for (const warning of plan.warnings || []) {
				const warningElement = document.createElement('div');
				warningElement.textContent = 'Aviso: ' + warning;
				wrapper.appendChild(warningElement);
			}

			for (const operation of plan.operations || []) {
				const row = document.createElement('label');
				row.className = 'operation';
				const checkbox = document.createElement('input');
				checkbox.type = 'checkbox';
				checkbox.checked = true;
				checkbox.value = operation.id;
				const text = document.createElement('span');
				text.textContent = operation.type + ': ' + (operation.filePath || operation.command) + (operation.rationale ? '\\n' + operation.rationale : '');
				row.appendChild(checkbox);
				row.appendChild(text);
				wrapper.appendChild(row);
				const diff = renderOperationPreview(operation);
				if (diff) {
					wrapper.appendChild(diff);
				}
			}

			const apply = document.createElement('button');
			apply.textContent = 'Accept selected';
			apply.addEventListener('click', () => {
				const operationIds = Array.from(wrapper.querySelectorAll('input[type="checkbox"]:checked')).map(input => input.value);
				vscode.postMessage({ type: 'applyComposerPlan', instruction, agent: agentName, plan, operationIds });
			});
			wrapper.appendChild(apply);
			const reject = document.createElement('button');
			reject.textContent = 'Reject';
			reject.addEventListener('click', () => wrapper.remove());
			wrapper.appendChild(reject);
			messages.appendChild(wrapper);
		}

		function renderThinking(steps) {
			thinking.innerHTML = '';
			for (const step of steps) {
				const item = document.createElement('div');
				item.className = 'step ' + step.state;
				item.textContent = (step.state === 'done' ? '[OK] ' : step.state === 'active' ? '[...] ' : '[ ] ') + step.label;
				thinking.appendChild(item);
			}
		}

		function renderRichText(container, text) {
			const fence = String.fromCharCode(96, 96, 96);
			const parts = String(text || '').split(fence);
			for (let index = 0; index < parts.length; index++) {
				if (index % 2 === 0) {
					container.appendChild(document.createTextNode(parts[index]));
					continue;
				}
				const raw = parts[index];
				const firstLineBreak = raw.indexOf('\\n');
				const code = firstLineBreak >= 0 ? raw.slice(firstLineBreak + 1) : raw;
				container.appendChild(renderCodeBlock(code.trim()));
			}
		}

		function renderCodeBlock(code) {
			const wrapper = document.createElement('div');
			wrapper.className = 'code-block';
			const actions = document.createElement('div');
			actions.className = 'code-actions';
			for (const action of [
				['Copy', () => navigator.clipboard?.writeText(code)],
				['Insert at Cursor', () => vscode.postMessage({ type: 'insertCode', code })],
				['Apply to File', () => vscode.postMessage({ type: 'applyCodeToFile', code })],
			]) {
				const button = document.createElement('button');
				button.textContent = action[0];
				button.addEventListener('click', action[1]);
				actions.appendChild(button);
			}
			const pre = document.createElement('pre');
			pre.textContent = code;
			wrapper.appendChild(actions);
			wrapper.appendChild(pre);
			return wrapper;
		}

		function renderOperationPreview(operation) {
			if (operation.type !== 'modify' && operation.type !== 'create' && operation.type !== 'delete') {
				return undefined;
			}
			const diff = document.createElement('div');
			diff.className = 'diff';
			if (operation.type === 'modify') {
				appendDiffLine(diff, '- ' + (operation.search || '[arquivo atual]'), 'remove');
				appendDiffLine(diff, '+ ' + (operation.replace || operation.content || '[novo conteudo]'), 'add');
			}
			if (operation.type === 'create') {
				appendDiffLine(diff, '+ create ' + operation.filePath, 'add');
				appendDiffLine(diff, '+ ' + operation.content.slice(0, 600), 'add');
			}
			if (operation.type === 'delete') {
				appendDiffLine(diff, '- delete ' + operation.filePath, 'remove');
			}
			return diff;
		}

		function appendDiffLine(container, text, kind) {
			const line = document.createElement('div');
			line.className = 'diff-line ' + kind;
			line.textContent = text;
			container.appendChild(line);
		}
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

const defaultAgents: readonly AgentDefinition[] = [
	{ id: 'deepseek', label: 'Princy Ai DeepSeek', modelName: 'deepseek-coder', isLocal: true },
	{ id: 'princy', label: 'Princy Ai', modelName: 'deepseek-coder', isLocal: true },
	{ id: 'qwen', label: 'Qwen Coder', modelName: 'qwen2.5-coder', isLocal: true },
	{ id: 'codellama', label: 'CodeLlama', modelName: 'codellama', isLocal: true },
	{ id: 'llama3', label: 'Llama 3.1', modelName: 'llama3.1', isLocal: true },
	{ id: 'mistral', label: 'Mistral', modelName: 'mistral', isLocal: true },
	{ id: 'openai', label: 'OpenAI', modelName: 'gpt-4o-mini', isLocal: false }
];
