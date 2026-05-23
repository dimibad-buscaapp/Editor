/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AgentClient, AgentDefinition, AgentModel, ComposerPlan, TerminalCommandResult } from './agentClient';
import { checkAgentBackend } from './agentConnectivity';
import { focusPrincyChatPanel, PRINCY_CHAT_VIEW_ID } from './princyWorkbenchChat';
import { buildChatPanelHtml } from './chatPanelHtml';
import { getMentionSuggestions, resolveContextMentions } from './contextMentions';
import type { NativeContextBundle } from './nativeContext';
import { loadPrincyRules } from './princyRules';
import { EMPTY_SHADOW_CONTEXT } from './shadowContext';
import { ChatMode, ChatSessionManager } from './chatSessions';

type ModelSegment = 'LOGIC' | 'FRONTEND' | 'BACKEND' | 'DEBUG';

type WebviewMessage =
	| { readonly type: 'sendMessage'; readonly text: string; readonly agent: AgentModel | 'auto'; readonly segmentMode?: ModelSegment; readonly priority?: 'normal' | 'high'; readonly chatMode?: ChatMode }
	| { readonly type: 'requestComposer'; readonly text: string; readonly agent: AgentModel }
	| { readonly type: 'applyComposerPlan'; readonly instruction: string; readonly agent: AgentModel; readonly plan: ComposerPlan; readonly operationIds: readonly string[] }
	| { readonly type: 'insertCode'; readonly code: string }
	| { readonly type: 'applyCodeToFile'; readonly code: string }
	| { readonly type: 'indexActiveFile' }
	| { readonly type: 'runCommand'; readonly command: string }
	| { readonly type: 'previewComposerOperation'; readonly operation: import('./agentClient').ComposerOperation }
	| { readonly type: 'mentionQuery'; readonly query: string }
	| { readonly type: 'indexWorkspace' }
	| { readonly type: 'quickFix' }
	| { readonly type: 'quickExplain' }
	| { readonly type: 'bootError' }
	| { readonly type: 'newSession' }
	| { readonly type: 'switchSession'; readonly sessionId: string }
	| { readonly type: 'deleteSession'; readonly sessionId: string }
	| { readonly type: 'setChatMode'; readonly mode: ChatMode }
	| { readonly type: 'openSettings' };

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
		private readonly chatSessions: ChatSessionManager,
		private readonly indexActiveFile: () => Promise<void>,
		private readonly runSuggestedCommand: (command?: string) => Promise<void>,
		private readonly collectNativeContext: () => Promise<NativeContextBundle>,
		private readonly applyComposerPlan: ApplyComposerPlan,
		private readonly insertCodeAtCursor: (code: string) => Promise<void>,
		private readonly applyCodeToFile: (code: string) => Promise<void>,
		private readonly previewComposerOperation: (operation: import('./agentClient').ComposerOperation) => Promise<void>
	) { }

	public resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.extensionUri]
		};
		this.reloadWebviewHtml(webviewView.webview);
		webviewView.webview.onDidReceiveMessage(message => this.handleMessage(message as WebviewMessage));
		webviewView.onDidChangeVisibility(() => {
			if (webviewView.visible) {
				void this.initializeChatPanel();
				webviewView.webview.postMessage({ type: 'reloadPanel' });
			}
		});
		void this.initializeChatPanel();
		vscode.window.onDidChangeActiveTextEditor(() => this.pushEditorContext());
		vscode.window.onDidChangeTextEditorSelection(() => this.pushEditorContext());
	}

	public async focus(): Promise<void> {
		if (!this.view) {
			await vscode.commands.executeCommand(PRINCY_CHAT_VIEW_ID);
		}
		this.view?.webview.postMessage({ type: 'focusInput' });
	}

	public async focusComposer(): Promise<void> {
		if (!this.view) {
			await vscode.commands.executeCommand(PRINCY_CHAT_VIEW_ID);
		}
		this.view?.webview.postMessage({ type: 'focusComposer' });
	}

	public async fixTerminalError(errorText: string): Promise<void> {
		await focusPrincyChatPanel();
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
				if (message.chatMode === 'composer') {
					await this.requestComposerPlan(message.text, this.resolveAgentChoice(message.agent));
					break;
				}
				await this.sendChatMessage(message.text, message.agent, message.segmentMode, message.priority, message.chatMode);
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
			case 'previewComposerOperation':
				await this.previewComposerOperation(message.operation);
				break;
			case 'mentionQuery':
				await this.replyMentionSuggestions(message.query);
				break;
			case 'indexWorkspace':
				await vscode.commands.executeCommand('princyai.indexWorkspace');
				break;
			case 'quickFix':
				await this.sendQuickFix();
				break;
			case 'quickExplain':
				await this.sendQuickExplain();
				break;
			case 'bootError':
				if (this.view) {
					this.reloadWebviewHtml(this.view.webview);
					void this.initializeChatPanel();
				}
				break;
			case 'newSession': {
				const mode = this.chatSessions.getActive()?.mode ?? 'chat';
				this.chatSessions.create(mode);
				this.pushSessionState();
				break;
			}
			case 'switchSession':
				if (this.chatSessions.switchTo(message.sessionId)) {
					this.pushSessionState();
				}
				break;
			case 'deleteSession':
				this.chatSessions.delete(message.sessionId);
				this.pushSessionState();
				break;
			case 'setChatMode': {
				const active = this.chatSessions.getActive();
				if (active) {
					this.chatSessions.setMode(active.id, message.mode);
					this.view?.webview.postMessage({ type: 'chatMode', mode: message.mode });
				}
				break;
			}
			case 'openSettings':
				await vscode.commands.executeCommand('workbench.action.openSettings');
				break;
		}
	}

	private pushSessionState(): void {
		const sessions = this.chatSessions.list().map(s => ({
			id: s.id,
			title: s.title,
			mode: s.mode,
			updatedAt: s.updatedAt
		}));
		const active = this.chatSessions.getActive();
		this.view?.webview.postMessage({
			type: 'sessionsState',
			sessions,
			activeId: this.chatSessions.getActiveId(),
			messages: active?.messages ?? [],
			activeMode: active?.mode ?? 'chat'
		});
	}

	private recordTurn(role: 'user' | 'assistant', text: string): void {
		const active = this.chatSessions.getActive();
		if (!active || !text.trim()) {
			return;
		}
		this.chatSessions.appendMessage(active.id, { role, text });
	}

	private reloadWebviewHtml(webview: vscode.Webview): void {
		webview.html = this.getHtml(webview);
	}

	private async sendQuickFix(): Promise<void> {
		const cfg = vscode.workspace.getConfiguration('princyai');
		const agent = cfg.get<AgentModel>('defaultAgent', 'deepseek');
		const editor = vscode.window.activeTextEditor;
		const selection = editor && !editor.selection.isEmpty ? editor.document.getText(editor.selection) : undefined;
		const text = selection
			? `Corrija este problema no código selecionado:\n\n${selection}`
			: 'Analise o arquivo ativo e o workspace; identifique o problema mais provável e proponha uma correção.';
		await this.sendChatMessage(text, agent, 'DEBUG', 'high');
	}

	private async sendQuickExplain(): Promise<void> {
		const cfg = vscode.workspace.getConfiguration('princyai');
		const agent = cfg.get<AgentModel>('defaultAgent', 'deepseek');
		const editor = vscode.window.activeTextEditor;
		const selection = editor && !editor.selection.isEmpty ? editor.document.getText(editor.selection) : undefined;
		const text = selection
			? `Explique este trecho de código de forma clara e didática:\n\n${selection}`
			: 'Explique o propósito e o funcionamento do arquivo ativo no workspace.';
		await this.sendChatMessage(text, agent, undefined, 'normal');
	}

	private async replyMentionSuggestions(query: string): Promise<void> {
		const suggestions = await getMentionSuggestions(query);
		this.view?.webview.postMessage({ type: 'mentionSuggestions', items: suggestions });
	}

	private pushEditorContext(): void {
		const editor = vscode.window.activeTextEditor;
		const selection = editor && !editor.selection.isEmpty
			? editor.document.getText(editor.selection)
			: undefined;
		const uri = editor?.document?.uri;
		const filePath = uri?.fsPath ?? uri?.toString();
		const fileName = filePath ? filePath.split(/[\\/]/).pop() : undefined;
		this.view?.webview.postMessage({
			type: 'context',
			fileName,
			hasSelection: Boolean(selection),
			selectionPreview: selection ? selection.slice(0, 80) + (selection.length > 80 ? '…' : '') : undefined
		});
	}

	private async initializeChatPanel(): Promise<void> {
		this.pushSessionState();
		const defaultAgent = vscode.workspace.getConfiguration('princyai').get<AgentModel>('defaultAgent', 'deepseek');
		this.view?.webview.postMessage({ type: 'defaultAgent', agent: defaultAgent });
		this.view?.webview.postMessage({ type: 'status', text: 'Pronto' });

		try {
			const models = await this.client.models();
			this.view?.webview.postMessage({ type: 'agents', models });
		} catch {
			this.view?.webview.postMessage({ type: 'agents', models: defaultAgents });
		}

		void this.refreshBackendStatusLazy();
	}

	private async refreshBackendStatusLazy(): Promise<void> {
		try {
			await this.client.resolveEndpoint();
			const endpoint = this.client.getAgentEndpoint();
			const status = await checkAgentBackend(this.client);
			this.view?.webview.postMessage({
				type: 'backendStatus',
				online: status.online,
				message: status.message,
				endpoint
			});
			if (!status.online) {
				this.view?.webview.postMessage({
					type: 'status',
					text: 'Backend offline — inicie o agent na porta 3210'
				});
			}
		} catch {
			// ignore — user can still type; send will show error
		}
	}

	private resolveAgentChoice(agent: AgentModel | 'auto'): AgentModel {
		if (agent === 'auto') {
			return vscode.workspace.getConfiguration('princyai').get<AgentModel>('defaultAgent', 'deepseek');
		}
		return agent;
	}

	private isSimpleChatMode(): boolean {
		return vscode.workspace.getConfiguration('princyai').get<boolean>('chat.simpleMode', false);
	}

	private shouldUseAgentJob(chatMode?: ChatMode): boolean {
		if (chatMode === 'agent') {
			return true;
		}
		if (chatMode === 'composer') {
			return false;
		}
		return !this.isSimpleChatMode();
	}

	private async requestComposerPlan(text: string, agent: AgentModel): Promise<void> {
		if (!text.trim()) {
			return;
		}

		this.recordTurn('user', `Composer: ${text}`);
		this.view?.webview.postMessage({ type: 'append', role: 'user', text: `Composer: ${text}` });
		this.view?.webview.postMessage({ type: 'status', text: 'Gerando plano…' });
		this.view?.webview.postMessage({ type: 'thinking', steps: [] });
		try {
			const nativeContext = await this.collectNativeContext();
			const { cleanMessage, attachments } = await resolveContextMentions(text, nativeContext.shadowContext);
			const rulesText = await loadPrincyRules();
			const attachmentBlock = attachments.map(item => item.content).join('\n\n');
			const instruction = [rulesText && `## Regras do projeto\n${rulesText}`, attachmentBlock, cleanMessage || text].filter(Boolean).join('\n\n');
			const plan = await this.client.composerPlan({
				agent,
				instruction,
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

	private async sendChatMessage(text: string, agent: AgentModel | 'auto', forceSegment?: ModelSegment, priority: 'normal' | 'high' = 'normal', chatMode?: ChatMode): Promise<void> {
		if (!text.trim()) {
			return;
		}

		const resolvedAgent = this.resolveAgentChoice(agent);
		const editor = vscode.window.activeTextEditor;
		const selectedText = editor && !editor.selection.isEmpty ? editor.document.getText(editor.selection) : undefined;
		const workspaceContext = vscode.workspace.workspaceFolders?.[0]?.name;
		const simple = !this.shouldUseAgentJob(chatMode);

		this.recordTurn('user', text);
		this.view?.webview.postMessage({ type: 'append', role: 'user', text });
		this.pushEditorContext();
		this.view?.webview.postMessage({ type: 'streamStart' });
		this.view?.webview.postMessage({ type: 'status', text: 'Gerando…' });
		if (!simple) {
			this.view?.webview.postMessage({ type: 'thinking', steps: [
				{ label: 'Coletando Shadow Context...', state: 'done' },
				{ label: 'THINKING: plano e RAG...', state: 'active' },
				{ label: 'GENERATING / COMPILING / TESTING...', state: 'pending' }
			] });
		} else {
			this.view?.webview.postMessage({ type: 'thinking', steps: [] });
		}

		const backend = await checkAgentBackend(this.client);
		if (!backend.online) {
			this.view?.webview.postMessage({ type: 'streamEnd', text: '', suggestedCommands: [] });
			this.view?.webview.postMessage({
				type: 'append',
				role: 'assistant',
				text: backend.message
			});
			this.view?.webview.postMessage({ type: 'status', text: 'Backend offline' });
			this.view?.webview.postMessage({ type: 'backendStatus', online: false, message: backend.message, endpoint: backend.endpoint });
			return;
		}

		try {
			let cleanMessage = text;
			let attachments: Awaited<ReturnType<typeof resolveContextMentions>>['attachments'] = [];
			let rulesText: string | undefined;
			let shadowContext: import('./agentClient').ShadowContext | undefined;
			let codeGraph: import('./agentClient').CodeGraphContext | undefined;

			if (simple) {
				const mentionResult = await resolveContextMentions(text, EMPTY_SHADOW_CONTEXT);
				cleanMessage = mentionResult.cleanMessage || text;
				attachments = mentionResult.attachments;
			} else {
				const nativeContext = await this.collectNativeContext();
				const mentionResult = await resolveContextMentions(text, nativeContext.shadowContext);
				cleanMessage = mentionResult.cleanMessage || text;
				attachments = mentionResult.attachments;
				rulesText = await loadPrincyRules();
				shadowContext = nativeContext.shadowContext;
				codeGraph = nativeContext.codeGraph;
			}

			if (simple) {
				const response = await this.client.chat({
					agent: resolvedAgent,
					message: cleanMessage,
					context: workspaceContext,
					async: false,
					force_segment: forceSegment,
					priority,
					filePath: editor?.document.uri.toString(),
					selectedText,
					contextAttachments: attachments,
					shadowContext,
					codeGraph
				});
				const reply = response.content ?? response.message ?? '';
				this.recordTurn('assistant', reply);
				this.view?.webview.postMessage({
					type: 'streamEnd',
					text: reply,
					suggestedCommands: response.suggestedCommands ?? []
				});
				this.view?.webview.postMessage({ type: 'status', text: 'Pronto' });
				return;
			}

			const started = await this.client.startAgentJob({
				agent: resolvedAgent,
				message: cleanMessage,
				context: workspaceContext,
				force_segment: forceSegment,
				priority,
				trigger_compile: priority === 'high',
				filePath: editor?.document.uri.toString(),
				selectedText,
				shadowContext,
				codeGraph,
				contextAttachments: attachments,
				rulesText: rulesText || undefined
			});

			if (!started.jobId?.trim()) {
				throw new Error('Backend nao retornou jobId. Atualize o agent backend no VPS (git pull + npm run build:backend).');
			}

			const response = await this.pollAgentJob(started.jobId);
			const planBlock = response.plan?.length
				? `Plano:\n${response.plan.map((step, index) => `${index + 1}. ${step}`).join('\n')}\n\n`
				: '';
			const reply = planBlock + (response.content ?? response.message ?? '');
			this.recordTurn('assistant', reply);
			this.view?.webview.postMessage({
				type: 'streamEnd',
				text: reply,
				suggestedCommands: response.suggestedCommands ?? []
			});
			this.view?.webview.postMessage({ type: 'status', text: 'Pronto' });
			if (response.metadata?.compile_job_id) {
				this.pollCompileJob(response.metadata.compile_job_id);
			}
		} catch (error) {
			const errDetail = error instanceof Error ? error.message : 'Erro desconhecido';
			const errText = `Erro: ${errDetail}`;
			this.recordTurn('assistant', errText);
			this.view?.webview.postMessage({ type: 'streamEnd', text: '', suggestedCommands: [] });
			this.view?.webview.postMessage({
				type: 'append',
				role: 'assistant',
				text: errText
			});
			this.view?.webview.postMessage({
				type: 'status',
				text: errDetail.includes('Failed to fetch') || errDetail.includes('inacessivel')
					? 'Falha de rede — agent backend (3210)?'
					: `Erro: ${errDetail.slice(0, 120)}${errDetail.length > 120 ? '…' : ''}`
			});
		}
	}

	private async pollAgentJob(jobId: string): Promise<import('./agentClient').ChatResponse> {
		try {
			return await new Promise<import('./agentClient').ChatResponse>((resolve, reject) => {
				void this.client.subscribeJobStream(jobId, {
					onDelta: text => {
						this.view?.webview.postMessage({ type: 'streamDelta', text });
					},
					onState: state => {
						this.postThinkingForState(state);
						this.view?.webview.postMessage({
							type: 'intelligence_status',
							text: `[Princy IA] ${state} | Gerando...`
						});
					},
					onDone: response => resolve(response),
					onError: message => reject(new Error(message))
				}).catch(reject);
			});
		} catch {
			return this.pollAgentJobFallback(jobId);
		}
	}

	private postThinkingForState(state: string): void {
		const steps = [
			{ label: 'THINKING', state: state === 'THINKING' ? 'active' : 'done' },
			{ label: 'GENERATING', state: state === 'GENERATING' ? 'active' : state === 'THINKING' ? 'pending' : 'done' },
			{ label: 'COMPILING', state: state === 'COMPILING' ? 'active' : ['TESTING', 'HEALING', 'SUCCESS', 'FAILED'].includes(state) ? 'done' : 'pending' },
			{ label: 'TESTING', state: state === 'TESTING' ? 'active' : state === 'HEALING' || state === 'SUCCESS' ? 'done' : 'pending' }
		];
		this.view?.webview.postMessage({ type: 'thinking', steps });
	}

	private async pollAgentJobFallback(jobId: string): Promise<import('./agentClient').ChatResponse> {
		let lastStreamedContent = '';
		for (let attempt = 0; attempt < 200; attempt++) {
			const snapshot = await this.client.getAgentJob(jobId);
			const lastThought = snapshot.thinkingLog[snapshot.thinkingLog.length - 1];
			if (lastThought) {
				this.view?.webview.postMessage({ type: 'intelligence_status', text: `[Princy IA] ${snapshot.state} | ${lastThought}` });
			}

			if (snapshot.content && snapshot.content !== lastStreamedContent) {
				this.view?.webview.postMessage({ type: 'streamDelta', text: snapshot.content });
				lastStreamedContent = snapshot.content;
			}

			this.postThinkingForState(snapshot.state);

			if (snapshot.response && (snapshot.status === 'COMPLETED' || snapshot.state === 'SUCCESS')) {
				return snapshot.response;
			}
			if (snapshot.status === 'FAILED' || snapshot.state === 'FAILED') {
				throw new Error(snapshot.error ?? 'Job do agente falhou');
			}
			await new Promise<void>(resolve => setTimeout(() => resolve(), 450));
		}
		throw new Error('Timeout aguardando job do agente');
	}

	private async pollCompileJob(jobId: string): Promise<void> {
		for (let attempt = 0; attempt < 30; attempt++) {
			await new Promise<void>(resolve => setTimeout(() => resolve(), 2000));
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
		return buildChatPanelHtml(webview.cspSource, nonce);
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
