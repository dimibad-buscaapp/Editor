/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AgentClient, AgentDefinition, AgentModel, ComposerPlan, ProjectTemplateId, TerminalCommandResult } from './agentClient';
import { checkAgentBackend, markBackendConnectivity, type BackendStatus } from './agentConnectivity';
import { runPrincyProjectCreate } from './princyProjectCreate';
import { focusPrincyChatPanel, PRINCY_CHAT_VIEW_ID } from './princyWorkbenchChat';
import { buildChatPanelHtml } from './chatPanelHtml';
import { PRINCY_CHAT_UI_REVISION } from './princyDesignTokens';
import { migrateWebAgentEndpoint } from './princyWorkbenchChat';
import { getMentionSuggestions, resolveContextMentions } from './contextMentions';
import type { NativeContextBundle } from './nativeContext';
import { loadPrincyRules } from './princyRules';
import { EMPTY_SHADOW_CONTEXT } from './shadowContext';
import { ChatMode, ChatSessionManager } from './chatSessions';
import { buildLineDiff } from './diffLines';
import { actionRunPhaseForAgentState, mapAgentJobStateToStatus, thinkingStepsForAgentState, labelForPrincyAiStatus } from './princyAiStatus';
import { setPrincyAiStatus } from './princyStatusBar';

type ModelSegment = 'LOGIC' | 'FRONTEND' | 'BACKEND' | 'DEBUG';

type WebviewMessage =
	| { readonly type: 'sendMessage'; readonly text?: string; readonly message?: string; readonly agent: AgentModel | 'auto'; readonly segmentMode?: ModelSegment; readonly priority?: 'normal' | 'high'; readonly chatMode?: ChatMode }
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
	| { readonly type: 'openSettings' }
	| { readonly type: 'reconnectBackend' }
	| { readonly type: 'panelReady' }
	| { readonly type: 'readFileForDiff'; readonly operationId: string; readonly filePath: string; readonly operation: import('./agentClient').ComposerOperation }
	| { readonly type: 'approveActionRun'; readonly jobId: string; readonly instruction: string; readonly agent: AgentModel; readonly plan: ComposerPlan }
	| { readonly type: 'rejectActionRun'; readonly jobId: string }
	| { readonly type: 'executePlan'; readonly jobId: string }
	| { readonly type: 'verifyComposer'; readonly jobId: string; readonly instruction: string; readonly agent: AgentModel; readonly plan: ComposerPlan }
	| { readonly type: 'startBuilder'; readonly target: import('./agentClient').BuildTarget }
	| { readonly type: 'startBuildCenter'; readonly target: import('./agentClient').BuildTarget; readonly projectSlug?: string; readonly note?: string }
	| { readonly type: 'downloadBuildCenter'; readonly buildId: string }
	| { readonly type: 'loadSiteInfo'; readonly slug: string }
	| { readonly type: 'syncSitePreview'; readonly slug: string; readonly projectSlug?: string }
	| { readonly type: 'publishSite'; readonly slug: string; readonly projectSlug?: string; readonly buildId?: string }
	| { readonly type: 'openSitePreview'; readonly url: string }
	| { readonly type: 'openExternalUrl'; readonly url: string }
	| { readonly type: 'loadApiStudioInfo'; readonly slug: string }
	| { readonly type: 'apiStudioScaffoldRoute'; readonly slug: string; readonly method: string; readonly path: string }
	| { readonly type: 'apiStudioMigrate'; readonly slug: string }
	| { readonly type: 'apiStudioTest'; readonly slug: string }
	| { readonly type: 'apiStudioOpenDocs'; readonly slug: string }
	| { readonly type: 'loadAutomationStudioInfo'; readonly slug: string }
	| { readonly type: 'automationScaffold'; readonly slug: string; readonly name: string; readonly schedule?: string }
	| { readonly type: 'automationSchedule'; readonly slug: string; readonly schedule: string }
	| { readonly type: 'automationRun'; readonly slug: string }
	| { readonly type: 'automationTest'; readonly slug: string }
	| { readonly type: 'automationPipeline'; readonly slug: string; readonly recipe: 'full-stack-web' | 'api-deploy' | 'daily-script' }
	| { readonly type: 'automationRunLocal'; readonly slug: string }
	| { readonly type: 'createProject'; readonly templateId: ProjectTemplateId; readonly projectName: string; readonly runInstall?: boolean }
	| { readonly type: 'openCreatedProject'; readonly projectPath: string }
	| { readonly type: 'buildCreatedProject'; readonly projectPath: string; readonly target: import('./agentClient').BuildTarget };

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

type PendingActionRun = {
	readonly jobId: string;
	readonly instruction: string;
	readonly agent: AgentModel;
	readonly plan: ComposerPlan;
};

const BACKEND_STATUS_TIMEOUT_MS = 20_000;

export class PrincyChatViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'princyai.chat';
	private view: vscode.WebviewView | undefined;
	private refreshBackendInFlight: Promise<void> | undefined;
	private initializeChatPanelInFlight: Promise<void> | undefined;
	private panelReadyHandled = false;
	private backendOnline = false;
	private readonly pendingWebviewMessages: Record<string, unknown>[] = [];
	private pendingActionRun: PendingActionRun | undefined;

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
			if (!webviewView.visible) {
				this.panelReadyHandled = false;
				return;
			}
			if (!this.panelReadyHandled) {
				this.reloadWebviewHtml(webviewView.webview);
				return;
			}
			void migrateWebAgentEndpoint();
			void this.refreshBackendStatusLazy(true);
		});
		void migrateWebAgentEndpoint();
		vscode.window.onDidChangeActiveTextEditor(() => this.pushEditorContext());
		vscode.window.onDidChangeTextEditorSelection(() => this.pushEditorContext());
	}

	public async focus(): Promise<void> {
		if (!this.view) {
			await vscode.commands.executeCommand(PRINCY_CHAT_VIEW_ID);
		}
		this.view?.webview.postMessage({ type: 'focusInput' });
	}

	/** Recarrega HTML/CSS do painel (forca visual novo apos deploy). */
	public forceReloadPanel(): void {
		if (!this.view) {
			return;
		}
		this.panelReadyHandled = false;
		this.reloadWebviewHtml(this.view.webview);
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
		await this.requestComposerPlan(prompt, 'princy');
	}

	private async handleMessage(message: WebviewMessage): Promise<void> {
		switch (message.type) {
			case 'sendMessage': {
				const text = (message.text ?? message.message ?? '').trim();
				if (message.chatMode === 'composer') {
					await this.requestComposerPlan(text, this.resolveAgentChoice(message.agent));
					break;
				}
				if (message.chatMode === 'builder' || message.chatMode === 'buildCenter') {
					await this.runBuildCenter(text, undefined, undefined, message.chatMode === 'builder');
					break;
				}
				if (message.chatMode === 'creator') {
					break;
				}
				if (message.chatMode === 'swarm') {
					await this.handleSwarmMessage(text, message.agent, message.segmentMode, message.priority);
					break;
				}
				await this.handleSendMessage(text, message.agent, message.segmentMode, message.priority, message.chatMode);
				break;
			}
			case 'approveActionRun':
				try {
					await this.handleApproveActionRun(message);
				} catch (error) {
					const errText = error instanceof Error ? error.message : String(error);
					this.view?.webview.postMessage({ type: 'status', text: errText });
					this.view?.webview.postMessage({ type: 'append', role: 'assistant', text: errText });
				}
				break;
			case 'rejectActionRun':
				await this.handleRejectActionRun(message.jobId);
				break;
			case 'verifyComposer':
				await this.handleVerifyComposer(message);
				break;
			case 'executePlan':
				await this.handleExecutePlan(message.jobId);
				break;
			case 'startBuilder':
				await this.runBuildCenter(undefined, message.target);
				break;
			case 'startBuildCenter':
				await this.runBuildCenter(message.note, message.target, message.projectSlug);
				break;
			case 'downloadBuildCenter':
				await this.downloadBuildCenterArtifact(message.buildId);
				break;
			case 'loadSiteInfo':
				await this.loadSiteInfo(message.slug);
				break;
			case 'syncSitePreview':
				await this.syncSitePreview(message.slug, message.projectSlug);
				break;
			case 'publishSite':
				await this.publishSite(message.slug, message.projectSlug, message.buildId);
				break;
			case 'openSitePreview':
				await vscode.env.openExternal(vscode.Uri.parse(message.url));
				break;
			case 'openExternalUrl':
				await vscode.env.openExternal(vscode.Uri.parse(message.url));
				break;
			case 'loadApiStudioInfo':
				await this.loadApiStudioInfo(message.slug);
				break;
			case 'apiStudioScaffoldRoute':
				await this.apiStudioScaffoldRoute(message.slug, message.method, message.path);
				break;
			case 'apiStudioMigrate':
				await this.apiStudioMigrate(message.slug);
				break;
			case 'apiStudioTest':
				await this.apiStudioTest(message.slug);
				break;
			case 'apiStudioOpenDocs':
				await this.apiStudioOpenDocs(message.slug);
				break;
			case 'loadAutomationStudioInfo':
				await this.loadAutomationStudioInfo(message.slug);
				break;
			case 'automationScaffold':
				await this.automationScaffold(message.slug, message.name, message.schedule);
				break;
			case 'automationSchedule':
				await this.automationSchedule(message.slug, message.schedule);
				break;
			case 'automationRun':
				await this.automationRun(message.slug);
				break;
			case 'automationTest':
				await this.automationTest(message.slug);
				break;
			case 'automationPipeline':
				await this.automationPipeline(message.slug, message.recipe);
				break;
			case 'automationRunLocal':
				await this.automationRunLocal(message.slug);
				break;
			case 'createProject':
				await this.runCreateProject(message.templateId, message.projectName, message.runInstall ?? true);
				break;
			case 'openCreatedProject':
				await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(message.projectPath), true);
				break;
			case 'buildCreatedProject':
				await this.runBuildCenter(undefined, message.target, undefined, false, message.projectPath);
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
			case 'reconnectBackend':
				await vscode.commands.executeCommand('princyai.reconnectBackend');
				break;
			case 'panelReady':
				this.panelReadyHandled = true;
				this.flushPendingWebviewMessages();
				void this.initializeChatPanel();
				break;
			case 'readFileForDiff':
				await this.replyFileDiff(message);
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
		this.postToWebview({
			type: 'sessionsState',
			sessions,
			activeId: this.chatSessions.getActiveId(),
			messages: active?.messages ?? [],
			activeMode: active?.mode ?? 'chat'
		});
	}

	private postToWebview(message: Record<string, unknown>): void {
		if (!this.view) {
			return;
		}
		const needsReady = message.type !== 'focusInput' && message.type !== 'focusComposer';
		if (needsReady && !this.panelReadyHandled) {
			this.pendingWebviewMessages.push(message);
			return;
		}
		void this.view.webview.postMessage(message);
	}

	private flushPendingWebviewMessages(): void {
		if (!this.view || this.pendingWebviewMessages.length === 0) {
			return;
		}
		const batch = this.pendingWebviewMessages.splice(0, this.pendingWebviewMessages.length);
		for (const message of batch) {
			void this.view.webview.postMessage(message);
		}
	}

	private recordTurn(role: 'user' | 'assistant', text: string): void {
		const active = this.chatSessions.getActive();
		if (!active || !text.trim()) {
			return;
		}
		this.chatSessions.appendMessage(active.id, { role, text });
	}

	private reloadWebviewHtml(webview: vscode.Webview): void {
		this.panelReadyHandled = false;
		webview.html = this.getHtml(webview);
	}

	private async sendQuickFix(): Promise<void> {
		const cfg = vscode.workspace.getConfiguration('princyai');
		const agent = cfg.get<AgentModel>('defaultAgent', 'princy');
		const editor = vscode.window.activeTextEditor;
		const selection = editor && !editor.selection.isEmpty ? editor.document.getText(editor.selection) : undefined;
		const text = selection
			? `Corrija este problema no código selecionado:\n\n${selection}`
			: 'Analise o arquivo ativo e o workspace; identifique o problema mais provável e proponha uma correção.';
		await this.sendChatMessage(text, agent, 'DEBUG', 'high');
	}

	private async sendQuickExplain(): Promise<void> {
		const cfg = vscode.workspace.getConfiguration('princyai');
		const agent = cfg.get<AgentModel>('defaultAgent', 'princy');
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
		if (this.initializeChatPanelInFlight) {
			return this.initializeChatPanelInFlight;
		}
		this.initializeChatPanelInFlight = this.runInitializeChatPanel().finally(() => {
			this.initializeChatPanelInFlight = undefined;
		});
		return this.initializeChatPanelInFlight;
	}

	private async runInitializeChatPanel(): Promise<void> {
		this.pushSessionState();
		const wsName = vscode.workspace.name ?? vscode.workspace.workspaceFolders?.[0]?.name ?? 'Workspace';
		this.postToWebview({ type: 'workspaceInfo', name: wsName });
		const defaultAgent = vscode.workspace.getConfiguration('princyai').get<AgentModel>('defaultAgent', 'princy');
		this.postToWebview({ type: 'defaultAgent', agent: defaultAgent });
		try {
			const models = await this.client.models();
			this.postToWebview({ type: 'agents', models });
		} catch {
			this.postToWebview({ type: 'agents', models: defaultAgents });
		}

		void this.loadCreatorTemplates();

		await this.refreshBackendStatusLazy(false);
		this.postToWebview({ type: 'reloadPanel' });
	}

	private postBackendStatus(status: BackendStatus): void {
		const endpoint = status.endpoint;
		this.backendOnline = status.online;
		markBackendConnectivity(status.online);
		this.postToWebview({
			type: 'backendStatus',
			online: status.online,
			message: status.message,
			endpoint
		});
		if (!status.online) {
			void setPrincyAiStatus({ kind: 'offline', label: labelForPrincyAiStatus('offline'), detail: status.message });
			this.postToWebview({
				type: 'status',
				text: `Backend offline (${endpoint}) — use Reconectar ou verifique :3210 /princy-api`
			});
		} else {
			void setPrincyAiStatus({ kind: 'ready', label: labelForPrincyAiStatus('ready'), detail: endpoint });
			this.postToWebview({ type: 'status', text: 'Pronto' });
		}
	}

	public async refreshBackendStatus(): Promise<void> {
		await this.refreshBackendStatusLazy(false);
	}

	private async refreshBackendStatusLazy(silentIfOnline: boolean): Promise<void> {
		if (this.refreshBackendInFlight) {
			return this.refreshBackendInFlight;
		}
		this.refreshBackendInFlight = this.runBackendStatusCheck(silentIfOnline).finally(() => {
			this.refreshBackendInFlight = undefined;
		});
		return this.refreshBackendInFlight;
	}

	private async runBackendStatusCheck(silentIfOnline: boolean): Promise<void> {
		if (!silentIfOnline || !this.backendOnline) {
			this.postToWebview({ type: 'status', text: 'A ligar ao backend…' });
			void setPrincyAiStatus({ kind: 'thinking', label: 'IA: A ligar…' });
		}
		try {
			const status = await Promise.race([
				(async () => {
					await this.client.resolveEndpoint();
					return checkAgentBackend(this.client);
				})(),
				new Promise<BackendStatus>((_, reject) => {
					setTimeout(() => reject(new Error(`Timeout (${BACKEND_STATUS_TIMEOUT_MS}ms) ao verificar backend`)), BACKEND_STATUS_TIMEOUT_MS);
				})
			]);
			this.postBackendStatus(status);
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			const endpoint = this.client.getAgentEndpoint();
			this.postBackendStatus({
				online: false,
				endpoint,
				message: `Falha ao verificar backend: ${detail}`
			});
		}
	}

	private resolveAgentChoice(agent: AgentModel | 'auto'): AgentModel {
		if (agent === 'auto') {
			return vscode.workspace.getConfiguration('princyai').get<AgentModel>('defaultAgent', 'princy');
		}
		return agent;
	}

	private isSimpleChatMode(): boolean {
		return vscode.workspace.getConfiguration('princyai').get<boolean>('chat.simpleMode', false);
	}

	private shouldUseAgentJob(chatMode?: ChatMode): boolean {
		if (chatMode === 'agent' || chatMode === 'chat' || chatMode === 'plan' || chatMode === 'swarm') {
			return true;
		}
		if (chatMode === 'composer' || chatMode === 'builder' || chatMode === 'buildCenter' || chatMode === 'apiStudio' || chatMode === 'automationStudio' || chatMode === 'creator') {
			return false;
		}
		return !this.isSimpleChatMode();
	}

	private apiModeForChat(chatMode?: ChatMode): 'chat' | 'composer' | 'agent' | 'plan' | undefined {
		if (chatMode === 'chat' || chatMode === 'agent' || chatMode === 'plan') {
			return chatMode;
		}
		return undefined;
	}

	private async handleExecutePlan(jobId: string): Promise<void> {
		this.view?.webview.postMessage({ type: 'status', text: 'A executar plano...' });
		const result = await this.client.executePlanJob(jobId);
		if (!result.ok) {
			throw new Error(result.message ?? 'Falha ao executar plano');
		}
		this.view?.webview.postMessage({ type: 'status', text: 'Plano em execucao...' });
		const snapshot = await this.client.getAgentJob(jobId);
		if (snapshot.response) {
			this.view?.webview.postMessage({ type: 'streamEnd', text: snapshot.response.content ?? '', suggestedCommands: [] });
		}
	}

	private async handleSwarmMessage(
		text: string,
		agent: AgentModel | 'auto',
		forceSegment?: ModelSegment,
		priority: 'normal' | 'high' = 'normal'
	): Promise<void> {
		if (!text.trim()) {
			return;
		}
		const resolvedAgent = this.resolveAgentChoice(agent);
		const editor = vscode.window.activeTextEditor;
		const selectedText = editor && !editor.selection.isEmpty ? editor.document.getText(editor.selection) : undefined;
		const workspaceContext = vscode.workspace.workspaceFolders?.[0]?.name;

		this.recordTurn('user', text);
		this.view?.webview.postMessage({ type: 'append', role: 'user', text });
		this.view?.webview.postMessage({ type: 'streamStart' });
		this.view?.webview.postMessage({ type: 'status', text: 'A iniciar swarm...' });
		this.view?.webview.postMessage({ type: 'actionRun', phase: 'planning', resultSummary: 'A decompor tarefa em agentes...' });

		const nativeContext = await this.collectNativeContext();
		const mentionResult = await resolveContextMentions(text, nativeContext.shadowContext);
		const cleanMessage = mentionResult.cleanMessage || text;
		const rulesText = await loadPrincyRules();

		const started = await this.client.startSwarmJob({
			agent: resolvedAgent,
			message: cleanMessage,
			context: workspaceContext,
			force_segment: forceSegment,
			priority,
			filePath: editor?.document.uri.toString(),
			selectedText,
			shadowContext: nativeContext.shadowContext,
			codeGraph: nativeContext.codeGraph,
			contextAttachments: mentionResult.attachments,
			rulesText: rulesText || undefined
		}, vscode.workspace.getConfiguration('princyai').get<number>('swarm.concurrency', 3));

		this.view?.webview.postMessage({ type: 'swarmGraph', graph: started.graph });
		void this.client.subscribeSwarmStream(started.swarmJobId, graph => {
			this.view?.webview.postMessage({ type: 'swarmGraph', graph });
		}, () => {
			this.view?.webview.postMessage({ type: 'status', text: 'Swarm concluido' });
		}).catch(() => undefined);

		const reply = `Swarm delegado — ${started.graph.nodes.length} sub-tarefas em paralelo. ID: ${started.swarmJobId}`;
		this.recordTurn('assistant', reply);
		this.view?.webview.postMessage({ type: 'streamEnd', text: reply, suggestedCommands: [] });
		this.view?.webview.postMessage({ type: 'status', text: 'Pronto' });
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

	private async handleSendMessage(
		text: string,
		agent: AgentModel | 'auto',
		forceSegment?: ModelSegment,
		priority: 'normal' | 'high' = 'normal',
		chatMode?: ChatMode
	): Promise<void> {
		this.postToWebview({ type: 'status', text: 'Coletando contexto...' });
		try {
			await this.sendChatMessage(text, agent, forceSegment, priority, chatMode);
		} catch (error) {
			this.postToWebview({
				type: 'error',
				message: error instanceof Error ? error.message : String(error)
			});
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
			this.view?.webview.postMessage({
				type: 'actionRun',
				phase: 'planning',
				resultSummary: 'A analisar o pedido...'
			});
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
			this.postBackendStatus(backend);
			return;
		}
		this.postBackendStatus(backend);

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

			if (simple && chatMode !== 'chat') {
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
				this.view?.webview.postMessage({ type: 'response', content: reply });
				void setPrincyAiStatus({ kind: 'ready', label: labelForPrincyAiStatus('ready') });
				this.view?.webview.postMessage({ type: 'status', text: 'Pronto' });
				return;
			}

			const isComposerJob = chatMode === 'composer';
			const started = await this.client.startAgentJob({
				agent: resolvedAgent,
				message: cleanMessage,
				context: workspaceContext,
				force_segment: forceSegment,
				priority,
				trigger_compile: chatMode === 'agent' ? (priority === 'high' || vscode.workspace.getConfiguration('princyai').get<boolean>('actionRun.autoCompileAfterApply', true)) : false,
				filePath: editor?.document.uri.toString(),
				selectedText,
				shadowContext,
				codeGraph,
				contextAttachments: attachments,
				rulesText: rulesText || undefined,
				mode: this.apiModeForChat(chatMode) ?? (isComposerJob ? 'composer' : 'agent'),
				actionOnlyExplain: chatMode === 'chat',
				skipPostApply: chatMode === 'composer' && !vscode.workspace.getConfiguration('princyai').get<boolean>('composer.autoVerify', false)
			});

			if (!started.jobId?.trim()) {
				throw new Error('Backend nao retornou jobId. Atualize o agent backend no VPS (git pull + npm run build:backend).');
			}

			const response = await this.pollAgentJob(started.jobId, cleanMessage, resolvedAgent, chatMode);
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
			void setPrincyAiStatus({ kind: 'ready', label: labelForPrincyAiStatus('ready') });
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

	private async handleApproveActionRun(message: Extract<WebviewMessage, { type: 'approveActionRun' }>): Promise<void> {
		const operationIds = message.plan.operations.map(op => op.id);
		this.view?.webview.postMessage({ type: 'thinking', steps: [
			{ label: 'Aprovando plano...', state: 'done' },
			{ label: 'Aplicando mudancas...', state: 'active' },
			{ label: 'Compilando / testando...', state: 'pending' }
		] });
		const approve = await this.client.approveAgentJob(message.jobId);
		if (!approve.ok) {
			throw new Error(approve.message ?? 'Falha ao aprovar job');
		}
		const result = await this.applyComposerPlan(message.plan, operationIds, message.instruction, message.agent);
		const cont = await this.client.continueAgentJob(message.jobId, result.appliedFiles);
		if (!cont.ok) {
			throw new Error(cont.message ?? 'Falha ao continuar job apos apply');
		}
		this.pendingActionRun = undefined;
		this.view?.webview.postMessage({
			type: 'actionRun',
			phase: 'applying',
			resultSummary: `Aplicado em ${result.appliedFiles.length} arquivo(s). Compilando...`
		});
	}

	private async handleRejectActionRun(jobId: string): Promise<void> {
		await this.client.rejectAgentJob(jobId);
		this.pendingActionRun = undefined;
		this.view?.webview.postMessage({ type: 'actionRun', phase: 'cancelled', resultSummary: 'Acao cancelada.' });
		this.view?.webview.postMessage({ type: 'status', text: 'Cancelado' });
	}

	private async handleVerifyComposer(message: Extract<WebviewMessage, { type: 'verifyComposer' }>): Promise<void> {
		await this.handleApproveActionRun({
			type: 'approveActionRun',
			jobId: message.jobId,
			instruction: message.instruction,
			agent: message.agent,
			plan: message.plan
		});
	}

	private async loadCreatorTemplates(): Promise<void> {
		try {
			const templates = await this.client.listProjectTemplates();
			const { projectsRoot, projects } = await this.client.listProjects();
			this.view?.webview.postMessage({ type: 'projectTemplates', templates, projectsRoot });
			this.view?.webview.postMessage({ type: 'buildCenterProjects', projects });
		} catch {
			const fallbackRoot = vscode.workspace.getConfiguration('princyai').get<string>('projects.root', 'workspace-storage/projetos');
			this.view?.webview.postMessage({ type: 'projectTemplates', templates: [], projectsRoot: fallbackRoot });
			this.view?.webview.postMessage({ type: 'buildCenterProjects', projects: [] });
		}
	}

	private async runCreateProject(templateId: ProjectTemplateId, projectName: string, runInstall: boolean): Promise<void> {
		this.view?.webview.postMessage({ type: 'status', text: 'Criando projeto...' });
		try {
			const { projectPath } = await runPrincyProjectCreate(this.client, templateId, projectName, {
				runInstall,
				openFolder: false
			});
			const summary = `Projeto criado em ${projectPath}`;
			this.recordTurn('assistant', summary);
			this.view?.webview.postMessage({
				type: 'projectCreated',
				projectPath,
				templateId,
				installLog: ''
			});
			this.view?.webview.postMessage({ type: 'append', role: 'assistant', text: summary });
			this.view?.webview.postMessage({ type: 'status', text: 'Projeto criado' });
		} catch (error) {
			const errText = error instanceof Error ? error.message : String(error);
			this.view?.webview.postMessage({ type: 'append', role: 'assistant', text: errText });
			this.view?.webview.postMessage({ type: 'status', text: errText });
			void setPrincyAiStatus({ kind: 'error', label: labelForPrincyAiStatus('error') });
		}
	}

	private async runBuildCenter(
		note?: string,
		target?: import('./agentClient').BuildTarget,
		projectSlug?: string,
		legacyBuilder = false,
		projectPath?: string
	): Promise<void> {
		const buildTarget = target ?? vscode.workspace.getConfiguration('princyai').get<import('./agentClient').BuildTarget>('builder.defaultTarget', 'web');
		const label = note?.trim() ? `Build (${buildTarget}): ${note}` : `Build: ${buildTarget}`;
		this.recordTurn('user', label);
		this.view?.webview.postMessage({ type: 'append', role: 'user', text: label });
		if (legacyBuilder) {
			this.view?.webview.postMessage({ type: 'actionRun', phase: 'building', buildTarget });
		}
		void setPrincyAiStatus({ kind: 'building', label: labelForPrincyAiStatus('building'), detail: buildTarget });

		try {
			const workspaceRoot = projectPath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
			const started = await this.client.startBuildCenter({
				type: buildTarget,
				...(projectSlug ? { projectSlug } : projectPath || workspaceRoot ? { projectPath: projectPath ?? workspaceRoot } : {}),
				...(note?.trim() ? { note: note.trim() } : {})
			});
			const logStreamUrl = await this.client.getBuildLogStreamUrl(started.buildId);
			this.view?.webview.postMessage({
				type: 'buildCenterStarted',
				buildId: started.buildId,
				status: started.status,
				logStreamUrl
			});
			const final = await this.client.pollBuildCenter(started.buildId, 1_800_000, snapshot => {
				this.view?.webview.postMessage({
					type: 'buildCenterStatus',
					buildId: snapshot.buildId,
					status: snapshot.status,
					artifactReady: snapshot.artifactReady,
					previewUrl: snapshot.previewUrl
				});
			});
			const summary = final.status === 'success'
				? `Build ${buildTarget} concluido.${final.artifactName ? ` Artefato: ${final.artifactName}` : ''}`
				: `Build ${buildTarget}: ${final.status}`;
			this.recordTurn('assistant', summary);
			this.view?.webview.postMessage({
				type: 'buildCenterStatus',
				buildId: final.buildId,
				status: final.status,
				artifactReady: final.artifactReady,
				previewUrl: final.previewUrl
			});
			if (buildTarget === 'web' && projectSlug) {
				void this.loadSiteInfo(projectSlug);
			}
			if (legacyBuilder) {
				this.view?.webview.postMessage({ type: 'actionRun', phase: final.status === 'success' ? 'completed' : 'failed', resultSummary: summary });
			}
			this.view?.webview.postMessage({ type: 'append', role: 'assistant', text: summary });
			void setPrincyAiStatus({ kind: final.status === 'success' ? 'ready' : 'error', label: labelForPrincyAiStatus(final.status === 'success' ? 'ready' : 'error') });
		} catch (error) {
			const errText = error instanceof Error ? error.message : String(error);
			this.view?.webview.postMessage({ type: 'append', role: 'assistant', text: errText });
			this.view?.webview.postMessage({ type: 'buildCenterStatus', status: 'error' });
			if (legacyBuilder) {
				this.view?.webview.postMessage({ type: 'actionRun', phase: 'failed', resultSummary: errText });
			}
		}
	}

	private async downloadBuildCenterArtifact(buildId: string): Promise<void> {
		try {
			const url = await this.client.getBuildDownloadUrl(buildId);
			await vscode.env.openExternal(vscode.Uri.parse(url));
		} catch (error) {
			const errText = error instanceof Error ? error.message : String(error);
			void vscode.window.showErrorMessage(errText);
		}
	}

	private async loadSiteInfo(slug: string): Promise<void> {
		try {
			const site = await this.client.getSiteInfo(slug);
			this.view?.webview.postMessage({ type: 'siteInfo', site });
		} catch {
			this.view?.webview.postMessage({ type: 'siteInfo', site: null });
		}
	}

	private async syncSitePreview(slug: string, projectSlug?: string): Promise<void> {
		try {
			const result = await this.client.syncSitePreview(slug, { projectSlug: projectSlug ?? slug });
			this.view?.webview.postMessage({ type: 'siteInfo', site: result.site });
			await vscode.env.openExternal(vscode.Uri.parse(result.previewUrl));
		} catch (error) {
			const errText = error instanceof Error ? error.message : String(error);
			void vscode.window.showErrorMessage(errText);
		}
	}

	private async publishSite(slug: string, projectSlug?: string, buildId?: string): Promise<void> {
		try {
			const result = await this.client.publishSite(slug, {
				projectSlug: projectSlug ?? slug,
				...(buildId ? { buildId } : {})
			});
			this.recordTurn('assistant', `Site publicado: ${result.publishedUrl}`);
			this.view?.webview.postMessage({ type: 'sitePublished', site: result.site, publishedUrl: result.publishedUrl });
			this.view?.webview.postMessage({ type: 'append', role: 'assistant', text: `Site publicado em ${result.publishedUrl}` });
		} catch (error) {
			const errText = error instanceof Error ? error.message : String(error);
			void vscode.window.showErrorMessage(errText);
		}
	}

	private async loadApiStudioInfo(slug: string): Promise<void> {
		try {
			const info = await this.client.getApiStudioInfo(slug);
			this.view?.webview.postMessage({ type: 'apiStudioInfo', info });
		} catch {
			this.view?.webview.postMessage({ type: 'apiStudioInfo', info: null });
		}
	}

	private async apiStudioScaffoldRoute(slug: string, method: string, routePath: string): Promise<void> {
		this.view?.webview.postMessage({ type: 'apiStudioStatus', status: 'compiling' });
		if (this.view?.webview) {
			this.view.webview.postMessage({ type: 'apiStudioLog', text: `[rota] ${method} ${routePath}\n` });
		}
		try {
			const result = await this.client.scaffoldApiRoute(slug, {
				method: method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
				path: routePath
			});
			this.view?.webview.postMessage({ type: 'apiStudioLog', text: `[ok] ${result.filePath}\n` });
			this.view?.webview.postMessage({ type: 'apiStudioStatus', status: 'success' });
		} catch (error) {
			const errText = error instanceof Error ? error.message : String(error);
			this.view?.webview.postMessage({ type: 'apiStudioLog', text: `[erro] ${errText}\n` });
			this.view?.webview.postMessage({ type: 'apiStudioStatus', status: 'error' });
		}
	}

	private async apiStudioMigrate(slug: string): Promise<void> {
		this.view?.webview.postMessage({ type: 'apiStudioStatus', status: 'compiling' });
		this.view?.webview.postMessage({ type: 'apiStudioLog', text: '[migrate] prisma migrate dev...\n' });
		try {
			const output = await this.client.migrateApiProject(slug);
			this.view?.webview.postMessage({ type: 'apiStudioLog', text: output.slice(-4000) + '\n' });
			this.view?.webview.postMessage({ type: 'apiStudioStatus', status: 'success' });
		} catch (error) {
			const errText = error instanceof Error ? error.message : String(error);
			this.view?.webview.postMessage({ type: 'apiStudioLog', text: `[erro] ${errText}\n` });
			this.view?.webview.postMessage({ type: 'apiStudioStatus', status: 'error' });
		}
	}

	private async apiStudioTest(slug: string): Promise<void> {
		this.view?.webview.postMessage({ type: 'apiStudioStatus', status: 'compiling' });
		this.view?.webview.postMessage({ type: 'apiStudioLog', text: '[test] endpoints...\n' });
		try {
			const result = await this.client.testApiEndpoints(slug, { startDev: true });
			this.view?.webview.postMessage({
				type: 'apiStudioLog',
				text: `[test] ${result.baseUrl} passed=${result.passed} failed=${result.failed}\n`
			});
			this.view?.webview.postMessage({ type: 'apiStudioStatus', status: result.failed ? 'error' : 'success' });
		} catch (error) {
			const errText = error instanceof Error ? error.message : String(error);
			this.view?.webview.postMessage({ type: 'apiStudioLog', text: `[erro] ${errText}\n` });
			this.view?.webview.postMessage({ type: 'apiStudioStatus', status: 'error' });
		}
	}

	private async apiStudioOpenDocs(slug: string): Promise<void> {
		try {
			const info = await this.client.getApiStudioInfo(slug);
			await vscode.env.openExternal(vscode.Uri.parse(info.docsUrl));
		} catch (error) {
			const errText = error instanceof Error ? error.message : String(error);
			void vscode.window.showErrorMessage(errText);
		}
	}

	private async loadAutomationStudioInfo(slug: string): Promise<void> {
		try {
			const info = await this.client.getAutomationStudioInfo(slug);
			this.view?.webview.postMessage({ type: 'automationStudioInfo', info });
		} catch {
			this.view?.webview.postMessage({ type: 'automationStudioInfo', info: null });
		}
	}

	private async automationScaffold(slug: string, name: string, schedule?: string): Promise<void> {
		this.view?.webview.postMessage({ type: 'automationStudioStatus', status: 'compiling' });
		this.view?.webview.postMessage({ type: 'automationStudioLog', text: `[gerar] ${name}\n` });
		try {
			const result = await this.client.scaffoldAutomation(slug, { name, schedule });
			this.view?.webview.postMessage({ type: 'automationStudioLog', text: `[ok] ${result.filePath}\n` });
			this.view?.webview.postMessage({ type: 'automationStudioStatus', status: 'success' });
		} catch (error) {
			const errText = error instanceof Error ? error.message : String(error);
			this.view?.webview.postMessage({ type: 'automationStudioLog', text: `[erro] ${errText}\n` });
			this.view?.webview.postMessage({ type: 'automationStudioStatus', status: 'error' });
		}
	}

	private async automationSchedule(slug: string, schedule: string): Promise<void> {
		this.view?.webview.postMessage({ type: 'automationStudioStatus', status: 'compiling' });
		try {
			const result = await this.client.scheduleAutomation(slug, schedule);
			this.view?.webview.postMessage({
				type: 'automationStudioLog',
				text: `[agendar] ${schedule}\n${result.localInstructions ?? ''}\n`
			});
			this.view?.webview.postMessage({ type: 'automationStudioStatus', status: 'success' });
		} catch (error) {
			const errText = error instanceof Error ? error.message : String(error);
			this.view?.webview.postMessage({ type: 'automationStudioLog', text: `[erro] ${errText}\n` });
			this.view?.webview.postMessage({ type: 'automationStudioStatus', status: 'error' });
		}
	}

	private async automationRun(slug: string): Promise<void> {
		this.view?.webview.postMessage({ type: 'automationStudioStatus', status: 'compiling' });
		try {
			const result = await this.client.runAutomation(slug);
			this.view?.webview.postMessage({
				type: 'automationStudioLog',
				text: `[run] exit=${result.exitCode}\n${result.output}\n`
			});
			this.view?.webview.postMessage({ type: 'automationStudioStatus', status: result.exitCode === 0 ? 'success' : 'error' });
		} catch (error) {
			const errText = error instanceof Error ? error.message : String(error);
			this.view?.webview.postMessage({ type: 'automationStudioLog', text: `[erro] ${errText}\n` });
			this.view?.webview.postMessage({ type: 'automationStudioStatus', status: 'error' });
		}
	}

	private async automationTest(slug: string): Promise<void> {
		this.view?.webview.postMessage({ type: 'automationStudioStatus', status: 'compiling' });
		try {
			const result = await this.client.testAutomation(slug);
			this.view?.webview.postMessage({
				type: 'automationStudioLog',
				text: `[test] exit=${result.exitCode}\n${result.output}\n`
			});
			this.view?.webview.postMessage({ type: 'automationStudioStatus', status: result.exitCode === 0 ? 'success' : 'error' });
		} catch (error) {
			const errText = error instanceof Error ? error.message : String(error);
			this.view?.webview.postMessage({ type: 'automationStudioLog', text: `[erro] ${errText}\n` });
			this.view?.webview.postMessage({ type: 'automationStudioStatus', status: 'error' });
		}
	}

	private async automationPipeline(slug: string, recipe: 'full-stack-web' | 'api-deploy' | 'daily-script'): Promise<void> {
		this.view?.webview.postMessage({ type: 'automationStudioStatus', status: 'compiling' });
		try {
			const result = await this.client.runAutomationPipeline(slug, recipe, { autoPublish: false });
			const lines = result.steps.map(s => `  ${s.stepId}: ${s.ok ? 'OK' : 'FALHA'} ${s.message ?? ''}`).join('\n');
			this.view?.webview.postMessage({ type: 'automationStudioLog', text: `[pipeline ${recipe}]\n${lines}\n` });
			this.view?.webview.postMessage({ type: 'automationStudioStatus', status: result.ok ? 'success' : 'error' });
		} catch (error) {
			const errText = error instanceof Error ? error.message : String(error);
			this.view?.webview.postMessage({ type: 'automationStudioLog', text: `[erro] ${errText}\n` });
			this.view?.webview.postMessage({ type: 'automationStudioStatus', status: 'error' });
		}
	}

	private async automationRunLocal(slug: string): Promise<void> {
		try {
			const info = await this.client.getAutomationStudioInfo(slug);
			const command = info.type === 'powershell'
				? 'powershell -ExecutionPolicy Bypass -File run.ps1'
				: 'npm run start';
			const terminal = vscode.window.createTerminal({ name: `Princy Auto: ${slug}`, cwd: info.projectPath });
			terminal.show();
			terminal.sendText(command);
			this.view?.webview.postMessage({ type: 'automationStudioLog', text: `[local] ${command}\n` });
		} catch (error) {
			const errText = error instanceof Error ? error.message : String(error);
			void vscode.window.showErrorMessage(errText);
		}
	}

	private showActionRunApproval(jobId: string, instruction: string, agent: AgentModel, plan: ComposerPlan): void {
		this.pendingActionRun = { jobId, instruction, agent, plan };
		this.view?.webview.postMessage({
			type: 'actionRun',
			phase: 'awaiting_approval',
			jobId,
			instruction,
			agent,
			approvalRequired: true
		});
		this.view?.webview.postMessage({ type: 'composerPlan', instruction, agent, plan, jobId, showApproval: true });
	}

	private async pollAgentJob(
		jobId: string,
		instruction: string,
		agent: AgentModel,
		chatMode?: ChatMode
	): Promise<import('./agentClient').ChatResponse> {
		try {
			return await new Promise<import('./agentClient').ChatResponse>((resolve, reject) => {
				void this.client.subscribeJobStream(jobId, {
					onDelta: text => {
						this.view?.webview.postMessage({ type: 'streamDelta', text });
						this.postThinkingForState('GENERATING', Boolean(text?.length));
					},
					onState: state => {
						this.postThinkingForState(state);
						this.view?.webview.postMessage({
							type: 'intelligence_status',
							text: `[Princy IA] ${state} | Gerando...`
						});
						if (state === 'AWAITING_APPROVAL') {
							if (chatMode === 'plan') {
								void this.client.getAgentJob(jobId).then(snap => {
									if (snap.planDag) {
										this.view?.webview.postMessage({ type: 'planDag', planDag: snap.planDag, jobId });
									}
								});
							} else {
								void this.tryShowApprovalFromSnapshot(jobId, instruction, agent);
							}
						}
					},
					onPhase: (phase, actionRun) => {
						this.view?.webview.postMessage({ type: 'actionRun', phase, actionRun });
						if (actionRun?.tasks?.length) {
							this.view?.webview.postMessage({ type: 'taskCards', cards: actionRun.tasks });
						}
					},
					onComposerPlan: plan => {
						if (chatMode === 'agent' || chatMode === 'composer') {
							this.showActionRunApproval(jobId, instruction, agent, plan);
						} else {
							this.view?.webview.postMessage({ type: 'composerPlan', instruction, agent, plan });
						}
					},
					onPlanDag: planDag => {
						this.view?.webview.postMessage({ type: 'planDag', planDag, jobId });
					},
					onReviewerReport: reviewerReport => {
						this.view?.webview.postMessage({ type: 'reviewerReport', reviewerReport });
					},
					onSwarmRef: swarmJobId => {
						void this.client.getSwarmGraph(swarmJobId).then(graph => {
							this.view?.webview.postMessage({ type: 'swarmGraph', graph });
						}).catch(() => undefined);
					},
					onTasks: tasks => {
						if (tasks?.length) {
							this.view?.webview.postMessage({ type: 'taskCards', cards: tasks });
						}
					},
					onAwaitingApproval: () => {
						void this.tryShowApprovalFromSnapshot(jobId, instruction, agent);
					},
					onDone: response => resolve(response),
					onError: message => reject(new Error(message))
				}).catch(reject);
			});
		} catch {
			return this.pollAgentJobFallback(jobId, instruction, agent, chatMode);
		}
	}

	private async tryShowApprovalFromSnapshot(jobId: string, instruction: string, agent: AgentModel): Promise<void> {
		if (this.pendingActionRun?.jobId === jobId) {
			return;
		}
		const snapshot = await this.client.getAgentJob(jobId);
		if (snapshot.composerPlan) {
			this.showActionRunApproval(jobId, instruction, agent, snapshot.composerPlan);
		}
	}

	private postThinkingForState(state: string, hasContent = false): void {
		const steps = thinkingStepsForAgentState(state);
		this.view?.webview.postMessage({ type: 'thinking', steps });
		const phase = actionRunPhaseForAgentState(state);
		const activeStep = steps.find(s => s.state === 'active');
		this.view?.webview.postMessage({
			type: 'actionRun',
			phase,
			actionRun: {
				tasks: steps.map(s => ({
					id: s.label,
					label: s.label,
					state: s.state === 'active' ? 'active' : s.state === 'done' ? 'done' : 'pending'
				}))
			},
			resultSummary: activeStep ? `${activeStep.label}...` : undefined
		});
		const status = mapAgentJobStateToStatus(state, hasContent);
		void setPrincyAiStatus({ kind: status.kind, label: status.label, detail: state });
		this.view?.webview.postMessage({ type: 'status', text: status.label.replace(/^IA:\s*/, '') });
	}

	private async pollAgentJobFallback(
		jobId: string,
		instruction: string,
		agent: AgentModel,
		chatMode?: ChatMode
	): Promise<import('./agentClient').ChatResponse> {
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

			this.postThinkingForState(snapshot.state, Boolean(snapshot.content?.length));

			if (snapshot.state === 'AWAITING_APPROVAL' && snapshot.planDag && chatMode === 'plan') {
				this.view?.webview.postMessage({ type: 'planDag', planDag: snapshot.planDag, jobId });
				return {
					content: snapshot.content,
					message: snapshot.content,
					metadata: snapshot.response?.metadata ?? {
						segment_used: 'LOGIC',
						primary_engine: 'planner',
						fallback_engines: [],
						execution_time: '0.0s',
						status: 'COMPLETED',
						vps_compile_status: 'SKIPPED',
						consensus_applied: false,
						phase: 'completed',
						timestamp: Date.now()
					}
				};
			}

			if (snapshot.state === 'AWAITING_APPROVAL' && snapshot.composerPlan && (chatMode === 'agent' || chatMode === 'composer')) {
				this.showActionRunApproval(jobId, instruction, agent, snapshot.composerPlan);
				return await this.waitJobAfterApproval(jobId);
			}

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

	private async waitJobAfterApproval(jobId: string): Promise<import('./agentClient').ChatResponse> {
		for (let attempt = 0; attempt < 400; attempt++) {
			const snapshot = await this.client.getAgentJob(jobId);
			this.postThinkingForState(snapshot.state, Boolean(snapshot.content?.length));
			if (snapshot.actionRun?.tasks?.length) {
				this.view?.webview.postMessage({ type: 'taskCards', cards: snapshot.actionRun.tasks });
			}
			if (snapshot.response && (snapshot.status === 'COMPLETED' || snapshot.state === 'SUCCESS')) {
				return snapshot.response;
			}
			if (snapshot.status === 'FAILED' || snapshot.state === 'FAILED') {
				throw new Error(snapshot.error ?? 'Job falhou apos aprovacao');
			}
			await new Promise<void>(resolve => setTimeout(() => resolve(), 800));
		}
		throw new Error('Timeout aguardando conclusao apos aprovacao');
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
		const media = vscode.Uri.joinPath(this.extensionUri, 'media');
		const rev = encodeURIComponent(PRINCY_CHAT_UI_REVISION);
		const cursorBase = webview.asWebviewUri(vscode.Uri.joinPath(media, 'chat-panel-cursor.css')).toString();
		const cursorStyleUri = `${cursorBase}${cursorBase.includes('?') ? '&' : '?'}princyUi=${rev}`;
		return buildChatPanelHtml(webview.cspSource, nonce, undefined, cursorStyleUri);
	}

	private async replyFileDiff(message: Extract<WebviewMessage, { type: 'readFileForDiff' }>): Promise<void> {
		const op = message.operation;
		let before = '';
		try {
			const folder = vscode.workspace.workspaceFolders?.[0];
			if (folder && message.filePath) {
				const uri = /^([a-zA-Z]:[\\/]|\/)/.test(message.filePath)
					? vscode.Uri.file(message.filePath)
					: vscode.Uri.joinPath(folder.uri, message.filePath);
				before = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
			}
		} catch {
			before = '';
		}
		let after = before;
		if (op.type === 'modify') {
			if (op.content) {
				after = op.content;
			} else if (op.search && op.replace !== undefined) {
				after = before.includes(op.search) ? before.replace(op.search, op.replace) : before + '\n' + op.replace;
			}
		} else if (op.type === 'create') {
			after = op.content ?? '';
		}
		const lines = buildLineDiff(before, after);
		this.view?.webview.postMessage({ type: 'diffFileContent', operationId: message.operationId, lines });
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
	{ id: 'princy', label: 'Princy IA', modelName: 'deepseek-coder', isLocal: true },
	{ id: 'deepseek', label: 'DeepSeek', modelName: 'deepseek-coder', isLocal: true },
	{ id: 'qwen', label: 'Qwen Coder', modelName: 'qwen2.5-coder', isLocal: true },
	{ id: 'codellama', label: 'CodeLlama', modelName: 'codellama', isLocal: true },
	{ id: 'llama3', label: 'Llama 3.1', modelName: 'llama3.1', isLocal: true },
	{ id: 'mistral', label: 'Mistral', modelName: 'mistral', isLocal: true },
	{ id: 'openai', label: 'OpenAI', modelName: 'gpt-4o-mini', isLocal: false }
];
