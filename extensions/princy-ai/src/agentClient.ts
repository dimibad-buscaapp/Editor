/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { subscribeAgentJobStream, type AgentJobStreamHandlers } from './agentJobStream';

interface FetchResponse {
	readonly ok: boolean;
	readonly status: number;
	readonly headers: { get(name: string): string | null };
	readonly body?: { getReader(): { read(): Promise<{ done: boolean; value?: Uint8Array }> } } | null;
	text(): Promise<string>;
	json(): Promise<unknown>;
}

declare const fetch: (
	input: string,
	init?: {
		readonly method?: string;
		readonly headers?: Record<string, string>;
		readonly body?: string;
		readonly cache?: string;
		readonly credentials?: string;
		readonly signal?: AbortSignal;
	}
) => Promise<FetchResponse>;

const AGENT_FETCH_TIMEOUT_MS = 15_000;

async function fetchAgent(
	url: string,
	init?: {
		readonly method?: string;
		readonly headers?: Record<string, string>;
		readonly body?: string;
		readonly cache?: string;
		readonly credentials?: string;
	}
): Promise<FetchResponse> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), AGENT_FETCH_TIMEOUT_MS);
	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			throw new Error(`Timeout (${AGENT_FETCH_TIMEOUT_MS}ms) em ${url}`);
		}
		throw error;
	} finally {
		clearTimeout(timer);
	}
}

export type AgentModel = 'princy' | 'deepseek' | 'qwen' | 'codellama' | 'llama3' | 'mistral' | 'openai';

export interface ShadowContext {
	readonly activeFilePath?: string;
	readonly activeLanguageId?: string;
	readonly activeContent?: string;
	readonly activeSelection?: string;
	readonly openTabs: readonly string[];
	readonly diagnostics: readonly string[];
	readonly workspaceFolders?: readonly string[];
	readonly workspaceTree?: readonly string[];
	readonly lastTerminalResult?: TerminalCommandResult;
}

export interface CodeGraphContext {
	readonly symbols: readonly string[];
	readonly definitions: readonly string[];
	readonly references: readonly string[];
}

export interface TerminalCommandResult {
	readonly command: string;
	readonly exitCode?: number;
	readonly output: string;
}

export type ComposerOperation =
	| { readonly id: string; readonly type: 'create'; readonly filePath: string; readonly content: string; readonly rationale?: string }
	| { readonly id: string; readonly type: 'modify'; readonly filePath: string; readonly search?: string; readonly replace?: string; readonly content?: string; readonly rationale?: string }
	| { readonly id: string; readonly type: 'delete'; readonly filePath: string; readonly rationale?: string }
	| { readonly id: string; readonly type: 'runCommand'; readonly command: string; readonly rationale?: string };

export interface ComposerPlan {
	readonly summary: string;
	readonly warnings: readonly string[];
	readonly affectedFiles: readonly string[];
	readonly operations: readonly ComposerOperation[];
}

export interface InlineEditRequest {
	readonly agent: AgentModel;
	readonly instruction: string;
	readonly selectedText: string;
	readonly languageId: string;
	readonly filePath: string;
	readonly shadowContext?: ShadowContext;
	readonly codeGraph?: CodeGraphContext;
}

export interface InlineEditResponse {
	readonly replacement: string;
	readonly explanation?: string;
}

export interface InlineCompleteRequest {
	readonly agent: AgentModel;
	readonly filePath: string;
	readonly languageId: string;
	readonly prefix: string;
	readonly suffix?: string;
	readonly linePrefix?: string;
}

export interface InlineCompleteResponse {
	readonly completion: string;
}

export type ModelSegment = 'LOGIC' | 'FRONTEND' | 'BACKEND' | 'DEBUG';

export interface ContextAttachmentPayload {
	readonly kind: string;
	readonly label: string;
	readonly content: string;
}

export type BuildTarget = 'web' | 'api' | 'exe' | 'apk';

export type BuildCenterStatus = 'waiting' | 'compiling' | 'error' | 'success';

export interface BuildCenterStatusResponse {
	readonly ok: boolean;
	readonly buildId: string;
	readonly type: BuildTarget;
	readonly status: BuildCenterStatus;
	readonly startedAt: number;
	readonly finishedAt?: number;
	readonly artifactReady: boolean;
	readonly artifactName?: string;
	readonly workspacePath: string;
	readonly projectSlug?: string;
	readonly previewUrl?: string;
}

export interface SiteInfo {
	readonly slug: string;
	readonly previewUrl: string;
	readonly publishedUrl: string;
	readonly hasPreview: boolean;
	readonly hasPublished: boolean;
	readonly publishedAt?: number;
	readonly sourceProjectPath?: string;
}

export interface ProjectListEntry {
	readonly slug: string;
	readonly path: string;
}

export interface ChatRequest {
	readonly agent: AgentModel;
	readonly message: string;
	readonly context?: string;
	readonly force_segment?: ModelSegment;
	readonly priority?: 'normal' | 'high';
	readonly stream?: boolean;
	readonly trigger_compile?: boolean;
	readonly async?: boolean;
	readonly filePath?: string;
	readonly selectedText?: string;
	readonly shadowContext?: ShadowContext;
	readonly codeGraph?: CodeGraphContext;
	readonly contextAttachments?: readonly ContextAttachmentPayload[];
	readonly rulesText?: string;
	readonly mode?: 'chat' | 'composer' | 'agent' | 'builder' | 'plan';
	readonly actionOnlyExplain?: boolean;
	readonly skipPostApply?: boolean;
	readonly workspaceId?: string;
}

export interface ChatMetadata {
	readonly segment_used: ModelSegment;
	readonly primary_engine: string;
	readonly fallback_engines: readonly string[];
	readonly execution_time: string;
	readonly status: string;
	readonly vps_compile_status: 'PENDING' | 'COMPILING' | 'READY' | 'FAILED' | 'SKIPPED';
	readonly consensus_applied: boolean;
	readonly phase: 'processing' | 'completed' | 'error' | 'compiling' | 'auto_healing';
	readonly compile_job_id?: string;
	readonly code_web_reachable?: boolean;
	readonly server_main_ready?: boolean;
	readonly timestamp: number;
}

export interface ChatResponse {
	readonly content: string;
	readonly message: string;
	readonly metadata: ChatMetadata;
	readonly plan?: readonly string[];
	readonly jobStatus?: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
	readonly intelligence_status?: string;
	readonly suggestedCommands?: readonly string[];
}

export interface AgentJobStartResponse {
	readonly jobId: string;
	readonly state: string;
	readonly status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
	readonly plan: readonly string[];
	readonly thinkingLog: readonly string[];
}

export interface ActionTask {
	readonly id: string;
	readonly label: string;
	readonly state: 'pending' | 'active' | 'done' | 'failed';
}

export interface ActionRunSnapshot {
	readonly runId: string;
	readonly mode: 'chat' | 'composer' | 'agent' | 'builder' | 'plan';
	readonly phase: string;
	readonly planSummary?: string;
	readonly planSteps?: readonly string[];
	readonly composerPlan?: ComposerPlan;
	readonly affectedFiles?: readonly string[];
	readonly buildTarget?: BuildTarget;
	readonly compileJobId?: string;
	readonly buildJobId?: string;
	readonly testOutput?: string;
	readonly resultSummary?: string;
	readonly approvalRequired: boolean;
	readonly approvalStatus?: 'pending' | 'approved' | 'rejected';
	readonly tasks?: readonly ActionTask[];
	readonly planDag?: PlanDag;
	readonly reviewerReport?: ReviewerReport;
	readonly swarmJobId?: string;
}

export interface PlanDagNode {
	readonly id: string;
	readonly label: string;
	readonly role?: string;
	readonly dependsOn: readonly string[];
	readonly state: 'pending' | 'active' | 'done' | 'failed';
}

export interface PlanDag {
	readonly nodes: readonly PlanDagNode[];
	readonly summary: string;
}

export interface ReviewerReport {
	readonly approved: boolean;
	readonly checklist: readonly { readonly item: string; readonly passed: boolean }[];
	readonly summary: string;
	readonly suggestions: readonly string[];
}

export interface SwarmGraphNode {
	readonly id: string;
	readonly role: string;
	readonly label: string;
	readonly state: string;
	readonly status: string;
	readonly dependsOn: readonly string[];
	readonly agentJobId?: string;
	readonly worktreePath?: string;
}

export interface SwarmGraph {
	readonly swarmJobId: string;
	readonly status: string;
	readonly prompt: string;
	readonly nodes: readonly SwarmGraphNode[];
	readonly edges: readonly { readonly from: string; readonly to: string }[];
}

export interface AgentJobSnapshot {
	readonly ok?: boolean;
	readonly jobId: string;
	readonly state: string;
	readonly status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
	readonly plan: readonly string[];
	readonly content: string;
	readonly thinkingLog: readonly string[];
	readonly error?: string;
	readonly response?: ChatResponse;
	readonly intelligence_status?: string;
	readonly composerPlan?: ComposerPlan;
	readonly approvalStatus?: 'pending' | 'approved' | 'rejected';
	readonly actionRun?: ActionRunSnapshot;
	readonly resultSummary?: string;
	readonly planDag?: PlanDag;
	readonly reviewerReport?: ReviewerReport;
	readonly swarmJobId?: string;
}

export interface BuildJobSnapshot {
	readonly ok?: boolean;
	readonly jobId: string;
	readonly target: BuildTarget;
	readonly status: string;
	readonly output: string;
	readonly artifactHint?: string;
}

export type ProjectTemplateId =
	| 'apk' | 'exe' | 'webapp' | 'saas' | 'api' | 'express-api' | 'webhook'
	| 'automation' | 'bot' | 'powershell-script' | 'browser-bot' | 'api-integration' | 'chatbot-support' | 'dashboard' | 'landing'
	| 'auth' | 'payments' | 'database';

export interface ApiStudioProjectInfo {
	readonly slug: string;
	readonly projectPath: string;
	readonly stack: 'fastify' | 'express' | 'unknown';
	readonly hasPrisma: boolean;
	readonly port: number;
	readonly docsUrl: string;
	readonly openapiUrl: string;
	readonly healthUrl: string;
}

export interface AutomationStudioProjectInfo {
	readonly slug: string;
	readonly projectPath: string;
	readonly type: 'powershell' | 'node-cron' | 'playwright' | 'webhook' | 'api-client' | 'chatbot' | 'unknown';
	readonly hasPrisma: boolean;
	readonly entryScript?: string;
	readonly schedule?: string;
	readonly taskName?: string;
	readonly lastRunAt?: number;
	readonly lastRunStatus?: 'success' | 'error';
	readonly lastHealthCheck?: number;
	readonly lastFailure?: string;
}

export interface ProjectTemplateSummary {
	readonly id: ProjectTemplateId;
	readonly name: string;
	readonly description: string;
	readonly stack: readonly string[];
	readonly build: string;
	readonly buildTarget?: BuildTarget;
	readonly tags?: readonly string[];
}

export interface CreateProjectResult {
	readonly ok: boolean;
	readonly message?: string;
	readonly projectPath?: string;
	readonly templateId?: ProjectTemplateId;
	readonly slug?: string;
	readonly installJobId?: string;
	readonly build?: string;
	readonly buildTarget?: BuildTarget;
}

export interface CreateProjectInstallJob {
	readonly ok?: boolean;
	readonly jobId: string;
	readonly status: string;
	readonly output: string;
	readonly projectPath: string;
}

export interface AgentDefinition {
	readonly id: AgentModel;
	readonly label: string;
	readonly modelName: string;
	readonly isLocal: boolean;
}

export interface IndexFileRequest {
	readonly filePath: string;
	readonly languageId: string;
	readonly content: string;
}

export interface ComposerPlanRequest {
	readonly agent: AgentModel;
	readonly instruction: string;
	readonly shadowContext?: ShadowContext;
	readonly codeGraph?: CodeGraphContext;
}

export interface RepairAfterCommandRequest {
	readonly agent: AgentModel;
	readonly originalInstruction: string;
	readonly previousPlan: ComposerPlan;
	readonly commandResult: TerminalCommandResult;
	readonly shadowContext?: ShadowContext;
	readonly codeGraph?: CodeGraphContext;
}

const DEFAULT_AGENT_ENDPOINT = 'https://princyai.com/princy-api';
const SAME_ORIGIN_PROXY_PATH = '/princy-api';

let cachedAgentEndpoint: string | undefined;

/** Limpa cache apos migrate de settings (evita endpoint antigo :3210 ou localhost errado). */
export function clearAgentEndpointCache(): void {
	cachedAgentEndpoint = undefined;
}

function isLocalDevHostname(hostname: string | undefined): boolean {
	if (!hostname) {
		return false;
	}
	const h = hostname.toLowerCase();
	return h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local');
}

function getConfiguredPublicWebOrigin(): string | undefined {
	const raw = (vscode.workspace.getConfiguration('princyai').get<string>('publicWebOrigin', '') ?? '').trim();
	if (raw) {
		return raw.replace(/\/+$/, '');
	}
	if (vscode.env.uiKind === vscode.UIKind.Web) {
		return 'https://princyai.com';
	}
	return undefined;
}

function getConfiguredServerBasePath(): string {
	const raw = (vscode.workspace.getConfiguration('princyai').get<string>('serverBasePath', '/webeditor') ?? '').trim();
	if (!raw || raw === '/') {
		return '';
	}
	return raw.startsWith('/') ? raw.replace(/\/+$/, '') : `/${raw.replace(/\/+$/, '')}`;
}

/** URLs HTTPS absolutas — Caddy /princy-api (3210) primeiro; /webeditor/princy-api so fallback. */
function getPreferredWebApiBases(): readonly string[] {
	const origin = getConfiguredPublicWebOrigin();
	if (!origin) {
		return [];
	}
	const basePath = getConfiguredServerBasePath();
	const bases: string[] = [`${origin}${SAME_ORIGIN_PROXY_PATH}`];
	if (basePath) {
		bases.push(`${origin}${basePath}${SAME_ORIGIN_PROXY_PATH}`);
	}
	return bases;
}

function normalizeProductionAgentEndpoint(endpoint: string): string {
	const trimmed = endpoint.replace(/\/+$/, '');
	// /webeditor/princy-api nao existe no Caddy — rota correta e /princy-api na raiz
	if (/\/webeditor\/princy-api$/i.test(trimmed)) {
		return trimmed.replace(/\/webeditor\/princy-api$/i, '/princy-api');
	}
	return trimmed;
}

function shouldCacheWebEndpoint(base: string): boolean {
	if (vscode.env.uiKind !== vscode.UIKind.Web) {
		return true;
	}
	const abs = toAbsoluteAgentEndpoint(base.replace(/\/+$/, ''));
	if (/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(abs)) {
		return false;
	}
	const pageProtocol = (globalThis as { location?: { protocol?: string } }).location?.protocol;
	if (pageProtocol === 'https:' && abs.startsWith('http://')) {
		return false;
	}
	return true;
}

function sanitizeWebAgentEndpoint(endpoint: string): string {
	const trimmed = endpoint.replace(/\/+$/, '');
	if (vscode.env.uiKind !== vscode.UIKind.Web) {
		return trimmed;
	}
	if (/:(3210)(\/|$)/i.test(trimmed)) {
		return SAME_ORIGIN_PROXY_PATH;
	}
	return trimmed;
}

export class AgentClient {
	private lastProbeNote: string | undefined;

	public clearEndpointCache(): void {
		cachedAgentEndpoint = undefined;
		this.lastProbeNote = undefined;
	}

	public getLastProbeNote(): string | undefined {
		return this.lastProbeNote;
	}

	private rememberEndpoint(base: string, note: string, cache = true): string {
		let endpoint = sanitizeWebAgentEndpoint(base.replace(/\/+$/, ''));
		if (vscode.env.uiKind === vscode.UIKind.Web) {
			endpoint = toAbsoluteAgentEndpoint(endpoint);
		}
		if (cache) {
			cachedAgentEndpoint = endpoint;
		}
		this.lastProbeNote = note;
		return endpoint;
	}

	private webFallbackEndpoint(relativeOrProxy: string): string {
		const fallback = getPreferredWebApiBases()[0] ?? toAbsoluteAgentEndpoint(relativeOrProxy);
		this.lastProbeNote = 'web fallback: todos os probes falharam (sem cache)';
		return sanitizeWebAgentEndpoint(
			vscode.env.uiKind === vscode.UIKind.Web ? toAbsoluteAgentEndpoint(fallback) : fallback
		);
	}

	/** Detecta a melhor URL da API (proxy mesma origem, localhost ou config manual). */
	public async resolveEndpoint(): Promise<string> {
		if (cachedAgentEndpoint) {
			const note = this.lastProbeNote ?? '';
			if (note.includes('probe ok') || note.startsWith('configured')) {
				return cachedAgentEndpoint;
			}
			cachedAgentEndpoint = undefined;
		}

		const configuration = vscode.workspace.getConfiguration('princyai');
		const configuredRaw = (configuration.get<string>('agentEndpoint', '') ?? '').trim();
		const configured = normalizeProductionAgentEndpoint(configuredRaw);
		const useSameOrigin = configuration.get<boolean>('useSameOriginApi', true);

		// Endpoint absoluto configurado — validar com probe no browser (evita /webeditor/princy-api morto).
		if (configured && configured !== 'auto' && !configured.startsWith('/')) {
			if (vscode.env.uiKind === vscode.UIKind.Web) {
				if (await this.probeEndpoint(configured)) {
					return this.rememberEndpoint(configured, `probe ok (configured): ${configured}`, shouldCacheWebEndpoint(configured));
				}
			} else if (configured !== DEFAULT_AGENT_ENDPOINT) {
				if (await this.probeEndpoint(configured)) {
					return this.rememberEndpoint(configured, `configured: ${configured}`);
				}
			}
		}

		// Endpoint relativo (/princy-api) — valida com probe; se falhar tenta outros candidatos (Caddy vs :3200).
		if (configured.startsWith('/') && useSameOrigin) {
			const relative = configured.replace(/\/+$/, '') || SAME_ORIGIN_PROXY_PATH;
			if (vscode.env.uiKind === vscode.UIKind.Web) {
				const candidates = [
					...getPreferredWebApiBases(),
					...buildWebApiCandidates().filter(c => c.replace(/\/+$/, '') !== relative),
					relative
				];
				for (const base of candidates) {
					if (await this.probeEndpoint(base)) {
						return this.rememberEndpoint(base, `probe ok: ${base}`, shouldCacheWebEndpoint(base));
					}
				}
				return this.webFallbackEndpoint(relative);
			}
			return this.rememberEndpoint(relative, `configured relative: ${relative}`);
		}

		if (vscode.env.uiKind === vscode.UIKind.Web) {
			if (useSameOrigin) {
				const candidates = [...getPreferredWebApiBases(), ...buildWebApiCandidates()];
				for (const base of candidates) {
					if (await this.probeEndpoint(base)) {
						return this.rememberEndpoint(base, `probe ok: ${base}`, shouldCacheWebEndpoint(base));
					}
				}
				return this.webFallbackEndpoint(SAME_ORIGIN_PROXY_PATH);
			}
		} else if (await this.probeEndpoint(DEFAULT_AGENT_ENDPOINT)) {
			return this.rememberEndpoint(DEFAULT_AGENT_ENDPOINT, `probe ok: ${DEFAULT_AGENT_ENDPOINT}`);
		}

		const fallback = (configured && configured !== 'auto' ? configured : DEFAULT_AGENT_ENDPOINT);
		return this.rememberEndpoint(fallback, `fallback: ${fallback}`);
	}

	public getAgentEndpoint(): string {
		return cachedAgentEndpoint ?? this.getConfiguredEndpoint();
	}

	private getConfiguredEndpoint(): string {
		return (vscode.workspace.getConfiguration('princyai').get<string>('agentEndpoint', DEFAULT_AGENT_ENDPOINT) ?? DEFAULT_AGENT_ENDPOINT)
			.replace(/\/+$/, '');
	}

	private async probeEndpoint(base: string): Promise<boolean> {
		const normalized = toAbsoluteAgentEndpoint(base.replace(/\/+$/, ''));
		const paths = ['/api/agent/health', '/api/health'];
		for (const path of paths) {
			try {
				const fetchUrl = await toFetchableAgentUrl(normalized, path);
				const response = await fetchAgent(fetchUrl, {
					method: 'GET',
					cache: 'no-store',
					credentials: 'omit'
				});
				if (!response.ok) {
					continue;
				}
				const contentType = response.headers.get('content-type') ?? '';
				if (contentType.includes('application/json')) {
					const body = await response.json() as { readonly ok?: boolean };
					if (body?.ok !== false) {
						return true;
					}
					continue;
				}
				return true;
			} catch {
				// try next path
			}
		}
		return false;
	}

	public async health(): Promise<{ readonly ok: boolean; readonly build?: string }> {
		return this.get<{ readonly ok: boolean; readonly build?: string }>('/api/health');
	}

	public async agentHealth(): Promise<{ readonly ok: boolean; readonly build?: string }> {
		return this.get<{ readonly ok: boolean; readonly build?: string }>('/api/agent/health');
	}

	public async models(): Promise<readonly AgentDefinition[]> {
		const response = await this.get<{ readonly models: readonly AgentDefinition[] }>('/api/agent/models');
		return response.models;
	}

	public async inlineEdit(request: InlineEditRequest): Promise<InlineEditResponse> {
		return this.post<InlineEditResponse>('/api/agent/inline-edit', request);
	}

	public async inlineComplete(request: InlineCompleteRequest): Promise<InlineCompleteResponse> {
		return this.post<InlineCompleteResponse>('/api/agent/inline-complete', request);
	}

	public async chat(request: ChatRequest): Promise<ChatResponse> {
		if (request.async === true) {
			const started = await this.startAgentJob(request);
			return this.waitForAgentJob(started.jobId);
		}
		return this.post<ChatResponse>('/api/agent/chat', { ...request, async: false });
	}

	public async startAgentJob(request: ChatRequest): Promise<AgentJobStartResponse> {
		const result = await this.post<AgentJobStartResponse & { readonly id?: string; readonly ok?: boolean }>('/api/agent/jobs', request);
		const jobId = (result.jobId ?? result.id ?? '').trim();
		if (!jobId) {
			throw new Error(
				'POST /api/agent/jobs nao retornou jobId. Verifique se o backend foi atualizado (GET /api/health deve ter build: 2026-05-fsm).'
			);
		}
		return { ...result, jobId };
	}

	public async subscribeJobStream(jobId: string, handlers: AgentJobStreamHandlers): Promise<void> {
		const token = vscode.workspace.getConfiguration('princyai').get<string>('apiToken', '');
		await subscribeAgentJobStream(await this.resolveEndpoint(), token, jobId, handlers);
	}

	public async getAgentJob(jobId: string): Promise<AgentJobSnapshot> {
		const normalizedJobId = jobId?.trim();
		if (!normalizedJobId) {
			throw new Error('jobId vazio — crie o job com POST /api/agent/jobs antes de fazer polling.');
		}
		return this.get<AgentJobSnapshot>(`/api/agent/jobs/${encodeURIComponent(normalizedJobId)}`);
	}

	public async waitForAgentJob(jobId: string, timeoutMs = 300_000): Promise<ChatResponse> {
		const startedAt = Date.now();
		while (Date.now() - startedAt < timeoutMs) {
			const snapshot = await this.getAgentJob(jobId);
			if (snapshot.response && (snapshot.status === 'COMPLETED' || snapshot.state === 'SUCCESS')) {
				return snapshot.response;
			}
			if (snapshot.status === 'FAILED' || snapshot.state === 'FAILED') {
				throw new Error(snapshot.error ?? 'Agent job failed');
			}
			await new Promise<void>(resolve => setTimeout(() => resolve(), 1500));
		}
		throw new Error('Agent job timeout');
	}

	public async getCompileStatus(jobId: string): Promise<{ readonly status: string; readonly output?: string }> {
		return this.get<{ readonly ok: boolean; readonly status: string; readonly output?: string }>(`/api/agent/compile-status/${encodeURIComponent(jobId)}`);
	}

	public async approveAgentJob(jobId: string): Promise<{ readonly ok: boolean; readonly message?: string }> {
		return this.post<{ readonly ok: boolean; readonly message?: string }>(`/api/agent/jobs/${encodeURIComponent(jobId)}/approve`, {});
	}

	public async rejectAgentJob(jobId: string): Promise<{ readonly ok: boolean; readonly message?: string }> {
		return this.post<{ readonly ok: boolean; readonly message?: string }>(`/api/agent/jobs/${encodeURIComponent(jobId)}/reject`, {});
	}

	public async executePlanJob(jobId: string): Promise<{ readonly ok: boolean; readonly message?: string }> {
		return this.post<{ readonly ok: boolean; readonly message?: string }>(`/api/agent/jobs/${encodeURIComponent(jobId)}/execute-plan`, {});
	}

	public async startSwarmJob(request: ChatRequest, concurrency?: number): Promise<{ readonly swarmJobId: string; readonly graph: SwarmGraph }> {
		return this.post<{ readonly ok: boolean; readonly swarmJobId: string; readonly graph: SwarmGraph }>('/api/agent/swarm', { ...request, concurrency });
	}

	public async getSwarmGraph(swarmJobId: string): Promise<SwarmGraph> {
		const result = await this.get<{ readonly ok: boolean; readonly graph: SwarmGraph }>(`/api/agent/swarm/${encodeURIComponent(swarmJobId)}/graph`);
		return result.graph;
	}

	public async subscribeSwarmStream(swarmJobId: string, onGraph: (graph: SwarmGraph) => void, onDone?: () => void): Promise<void> {
		const token = vscode.workspace.getConfiguration('princyai').get<string>('apiToken', '');
		const headers: Record<string, string> = {};
		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}
		const endpoint = await this.resolveEndpoint();
		const response = await fetch(`${endpoint}/api/agent/swarm/${encodeURIComponent(swarmJobId)}/stream`, { headers });
		if (!response.ok) {
			throw new Error(await response.text());
		}
		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error('Swarm SSE unavailable');
		}
		const decoder = new TextDecoder();
		let buffer = '';
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			buffer += decoder.decode(value);
			const events = buffer.split('\n\n');
			buffer = events.pop() ?? '';
			for (const event of events) {
				const line = event.split('\n').find(entry => entry.startsWith('data:'));
				if (!line) {
					continue;
				}
				const payload = JSON.parse(line.slice(5).trim()) as { readonly type: string; readonly graph?: SwarmGraph };
				if (payload.type === 'swarmGraph' && payload.graph) {
					onGraph(payload.graph);
				}
				if (payload.type === 'done') {
					onDone?.();
					return;
				}
			}
		}
	}

	public async continueAgentJob(jobId: string, appliedPaths: readonly string[]): Promise<{ readonly ok: boolean; readonly message?: string }> {
		return this.post<{ readonly ok: boolean; readonly message?: string }>(`/api/agent/jobs/${encodeURIComponent(jobId)}/continue`, {
			applied: true,
			paths: [...appliedPaths]
		});
	}

	public async startBuildCenter(input: {
		readonly type: BuildTarget;
		readonly projectPath?: string;
		readonly projectSlug?: string;
		readonly note?: string;
	}): Promise<{ readonly buildId: string; readonly status: BuildCenterStatus }> {
		const result = await this.post<{
			readonly ok: boolean;
			readonly buildId?: string;
			readonly status?: BuildCenterStatus;
			readonly message?: string;
		}>('/api/build/start', input);
		if (!result.ok || !result.buildId) {
			throw new Error(result.message ?? 'Falha ao iniciar build');
		}
		return { buildId: result.buildId, status: result.status ?? 'waiting' };
	}

	public async getBuildCenterStatus(buildId: string): Promise<BuildCenterStatusResponse> {
		return this.get<BuildCenterStatusResponse>(`/api/build/${encodeURIComponent(buildId)}/status`);
	}

	public async getBuildLogStreamUrl(buildId: string): Promise<string> {
		const endpoint = toAbsoluteAgentEndpoint(await this.resolveEndpoint());
		return `${endpoint}/api/build/${encodeURIComponent(buildId)}/logs`;
	}

	public async getBuildDownloadUrl(buildId: string): Promise<string> {
		const endpoint = toAbsoluteAgentEndpoint(await this.resolveEndpoint());
		return `${endpoint}/api/build/${encodeURIComponent(buildId)}/download`;
	}

	public async listProjects(): Promise<{ readonly projectsRoot: string; readonly projects: readonly ProjectListEntry[] }> {
		const result = await this.get<{ readonly ok: boolean; readonly projectsRoot: string; readonly projects: readonly ProjectListEntry[] }>('/api/projects');
		return { projectsRoot: result.projectsRoot, projects: result.projects ?? [] };
	}

	public async getSiteInfo(slug: string): Promise<SiteInfo> {
		const result = await this.get<{ readonly ok: boolean; readonly site: SiteInfo }>(
			`/api/sites/${encodeURIComponent(slug)}`
		);
		if (!result.site) {
			throw new Error('Site nao encontrado');
		}
		return result.site;
	}

	public async syncSitePreview(slug: string, input?: {
		readonly projectSlug?: string;
		readonly projectPath?: string;
	}): Promise<{ readonly previewUrl: string; readonly site: SiteInfo }> {
		const result = await this.post<{
			readonly ok: boolean;
			readonly previewUrl?: string;
			readonly site?: SiteInfo;
			readonly message?: string;
		}>(`/api/sites/${encodeURIComponent(slug)}/preview-sync`, input ?? {});
		if (!result.ok || !result.previewUrl) {
			throw new Error(result.message ?? 'Falha ao sincronizar preview');
		}
		return { previewUrl: result.previewUrl, site: result.site! };
	}

	public async publishSite(slug: string, input?: {
		readonly projectSlug?: string;
		readonly projectPath?: string;
		readonly buildId?: string;
	}): Promise<{ readonly publishedUrl: string; readonly site: SiteInfo }> {
		const result = await this.post<{
			readonly ok: boolean;
			readonly publishedUrl?: string;
			readonly site?: SiteInfo;
			readonly message?: string;
		}>(`/api/sites/${encodeURIComponent(slug)}/publish`, input ?? {});
		if (!result.ok || !result.publishedUrl) {
			throw new Error(result.message ?? 'Falha ao publicar site');
		}
		return { publishedUrl: result.publishedUrl, site: result.site! };
	}

	public async getApiStudioInfo(slug: string, projectPath?: string): Promise<ApiStudioProjectInfo> {
		const q = projectPath ? `?projectPath=${encodeURIComponent(projectPath)}` : '';
		const result = await this.get<{ readonly ok: boolean; readonly project: ApiStudioProjectInfo }>(
			`/api/studio/${encodeURIComponent(slug)}${q}`
		);
		if (!result.project) {
			throw new Error('Projeto API nao encontrado');
		}
		return result.project;
	}

	public async scaffoldApiRoute(
		slug: string,
		input: { readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; readonly path: string; readonly projectSlug?: string }
	): Promise<{ readonly filePath: string }> {
		const result = await this.post<{ readonly ok: boolean; readonly filePath?: string; readonly message?: string }>(
			`/api/studio/${encodeURIComponent(slug)}/routes`,
			{ method: input.method, path: input.path, projectSlug: input.projectSlug ?? slug }
		);
		if (!result.ok || !result.filePath) {
			throw new Error(result.message ?? 'Falha ao criar rota');
		}
		return { filePath: result.filePath };
	}

	public async migrateApiProject(slug: string, name?: string, projectSlug?: string): Promise<string> {
		const result = await this.post<{ readonly ok: boolean; readonly output?: string; readonly message?: string }>(
			`/api/studio/${encodeURIComponent(slug)}/prisma/migrate`,
			{ name, projectSlug: projectSlug ?? slug }
		);
		if (!result.ok) {
			throw new Error(result.message ?? 'Falha na migration');
		}
		return result.output ?? '';
	}

	public async testApiEndpoints(
		slug: string,
		options?: { readonly startDev?: boolean; readonly projectSlug?: string }
	): Promise<{ readonly passed: number; readonly failed: number; readonly baseUrl: string }> {
		const result = await this.post<{
			readonly ok: boolean;
			readonly passed?: number;
			readonly failed?: number;
			readonly baseUrl?: string;
			readonly message?: string;
		}>(`/api/studio/${encodeURIComponent(slug)}/test`, {
			useDefaults: true,
			startDev: options?.startDev ?? true,
			projectSlug: options?.projectSlug ?? slug
		});
		if (!result.ok) {
			throw new Error(result.message ?? 'Falha nos testes');
		}
		return {
			passed: result.passed ?? 0,
			failed: result.failed ?? 0,
			baseUrl: result.baseUrl ?? ''
		};
	}

	public async getAutomationStudioInfo(slug: string, projectPath?: string): Promise<AutomationStudioProjectInfo> {
		const q = projectPath ? `?projectPath=${encodeURIComponent(projectPath)}` : '';
		const result = await this.get<{ readonly ok: boolean; readonly project: AutomationStudioProjectInfo }>(
			`/api/automations/${encodeURIComponent(slug)}${q}`
		);
		if (!result.project) {
			throw new Error('Projeto de automacao nao encontrado');
		}
		return result.project;
	}

	public async scaffoldAutomation(
		slug: string,
		input: { readonly name: string; readonly schedule?: string; readonly description?: string; readonly projectPath?: string }
	): Promise<{ readonly filePath: string }> {
		const result = await this.post<{ readonly ok: boolean; readonly filePath?: string; readonly message?: string }>(
			`/api/automations/${encodeURIComponent(slug)}/scaffold`,
			input
		);
		if (!result.ok || !result.filePath) {
			throw new Error(result.message ?? 'Falha ao gerar automacao');
		}
		return { filePath: result.filePath };
	}

	public async runAutomation(slug: string, projectPath?: string): Promise<{ readonly exitCode: number; readonly output: string }> {
		const result = await this.post<{ readonly ok: boolean; readonly exitCode?: number; readonly output?: string; readonly message?: string }>(
			`/api/automations/${encodeURIComponent(slug)}/run`,
			projectPath ? { projectPath } : {}
		);
		if (!result.ok) {
			throw new Error(result.message ?? 'Falha ao executar automacao');
		}
		return { exitCode: result.exitCode ?? 1, output: result.output ?? '' };
	}

	public async testAutomation(slug: string, projectPath?: string): Promise<{ readonly exitCode: number; readonly output: string }> {
		const result = await this.post<{ readonly ok: boolean; readonly exitCode?: number; readonly output?: string; readonly message?: string }>(
			`/api/automations/${encodeURIComponent(slug)}/test`,
			projectPath ? { projectPath } : {}
		);
		return {
			exitCode: result.exitCode ?? (result.ok ? 0 : 1),
			output: result.output ?? result.message ?? ''
		};
	}

	public async scheduleAutomation(slug: string, schedule: string, projectPath?: string): Promise<{ readonly localInstructions?: string }> {
		const result = await this.post<{ readonly ok: boolean; readonly localInstructions?: string; readonly message?: string }>(
			`/api/automations/${encodeURIComponent(slug)}/schedule`,
			{ schedule, ...(projectPath ? { projectPath } : {}) }
		);
		if (!result.ok) {
			throw new Error(result.message ?? 'Falha ao agendar');
		}
		return { localInstructions: result.localInstructions };
	}

	public async runAutomationPipeline(
		slug: string,
		recipe: 'full-stack-web' | 'api-deploy' | 'daily-script',
		options?: { readonly autoPublish?: boolean; readonly projectPath?: string }
	): Promise<{ readonly ok: boolean; readonly steps: readonly { readonly stepId: string; readonly ok: boolean; readonly message?: string }[] }> {
		const result = await this.post<{
			readonly ok: boolean;
			readonly steps?: readonly { readonly stepId: string; readonly ok: boolean; readonly message?: string }[];
			readonly message?: string;
		}>(`/api/automations/${encodeURIComponent(slug)}/pipeline`, { recipe, ...options });
		return { ok: result.ok, steps: result.steps ?? [] };
	}

	public async pollBuildCenter(
		buildId: string,
		timeoutMs = 1_800_000,
		onStatus?: (status: BuildCenterStatusResponse) => void
	): Promise<BuildCenterStatusResponse> {
		const startedAt = Date.now();
		while (Date.now() - startedAt < timeoutMs) {
			const snapshot = await this.getBuildCenterStatus(buildId);
			onStatus?.(snapshot);
			if (snapshot.status === 'success' || snapshot.status === 'error') {
				return snapshot;
			}
			await new Promise<void>(resolve => setTimeout(() => resolve(), 1500));
		}
		throw new Error('Timeout aguardando build');
	}

	public async startBuild(target: BuildTarget, workspaceRoot?: string): Promise<BuildJobSnapshot> {
		const projectPath = workspaceRoot?.trim();
		const started = await this.startBuildCenter({
			type: target,
			...(projectPath ? { projectPath } : {})
		});
		return this.legacySnapshotFromBuildCenter(started.buildId);
	}

	public async getBuildJob(jobId: string): Promise<BuildJobSnapshot> {
		return this.legacySnapshotFromBuildCenter(jobId);
	}

	private async legacySnapshotFromBuildCenter(buildId: string): Promise<BuildJobSnapshot> {
		const center = await this.getBuildCenterStatus(buildId);
		const legacyStatus =
			center.status === 'success' ? 'READY'
				: center.status === 'error' ? 'FAILED'
					: center.status === 'compiling' ? 'BUILDING'
						: 'QUEUED';
		let output = '';
		try {
			const logs = await this.get<{ readonly ok: boolean; readonly lines: string }>(
				`/api/build/${encodeURIComponent(buildId)}/logs?offset=0`
			);
			output = logs.lines?.slice(-12_000) ?? '';
		} catch {
			// ignore log fetch errors for legacy snapshot
		}
		return {
			jobId: buildId,
			target: center.type,
			status: legacyStatus,
			output,
			artifactHint: center.artifactReady ? center.artifactName : undefined
		};
	}

	public async listProjectTemplates(): Promise<readonly ProjectTemplateSummary[]> {
		const result = await this.get<{ readonly ok: boolean; readonly templates: readonly ProjectTemplateSummary[] }>('/api/projects/templates');
		return result.templates ?? [];
	}

	public async createProject(templateId: ProjectTemplateId, projectName: string, runInstall = false): Promise<CreateProjectResult> {
		return this.post<CreateProjectResult>('/api/projects/create', { templateId, projectName, runInstall });
	}

	public async getCreateProjectInstallJob(jobId: string): Promise<CreateProjectInstallJob> {
		return this.get<CreateProjectInstallJob>(`/api/projects/create/${encodeURIComponent(jobId)}`);
	}

	public async pollCreateProjectInstall(jobId: string, timeoutMs = 600_000): Promise<CreateProjectInstallJob> {
		const startedAt = Date.now();
		while (Date.now() - startedAt < timeoutMs) {
			const snapshot = await this.getCreateProjectInstallJob(jobId);
			if (snapshot.status === 'READY' || snapshot.status === 'FAILED') {
				return snapshot;
			}
			await new Promise<void>(resolve => setTimeout(() => resolve(), 2000));
		}
		throw new Error('Timeout aguardando npm install');
	}

	public async pollBuildJob(jobId: string, timeoutMs = 1_800_000): Promise<BuildJobSnapshot> {
		const startedAt = Date.now();
		while (Date.now() - startedAt < timeoutMs) {
			const snapshot = await this.getBuildJob(jobId);
			if (snapshot.status === 'READY' || snapshot.status === 'FAILED' || snapshot.status === 'SKIPPED') {
				return snapshot;
			}
			await new Promise<void>(resolve => setTimeout(() => resolve(), 2000));
		}
		throw new Error('Timeout aguardando build');
	}

	public async indexFile(request: IndexFileRequest): Promise<void> {
		await this.post<{ ok: boolean }>('/api/agent/index-file', request);
	}

	public async indexFilesBatch(
		files: readonly { readonly filePath: string; readonly languageId: string; readonly content: string }[]
	): Promise<number> {
		const result = await this.post<{ readonly ok: boolean; readonly indexed: number }>('/api/agent/index-batch', { files });
		return result.indexed;
	}

	public async composerPlan(request: ComposerPlanRequest): Promise<ComposerPlan> {
		return this.post<ComposerPlan>('/api/agent/composer-plan', request);
	}

	public async repairAfterCommand(request: RepairAfterCommandRequest): Promise<ComposerPlan> {
		return this.post<ComposerPlan>('/api/agent/repair-after-command', request);
	}

	private async post<T>(path: string, body: unknown): Promise<T> {
		return this.request<T>(path, {
			method: 'POST',
			body: JSON.stringify(body)
		});
	}

	private async get<T>(path: string): Promise<T> {
		return this.request<T>(path, {
			method: 'GET'
		});
	}

	private async request<T>(path: string, init: { readonly method: string; readonly body?: string }): Promise<T> {
		const endpoint = toAbsoluteAgentEndpoint(await this.resolveEndpoint());
		const token = vscode.workspace.getConfiguration('princyai').get<string>('apiToken', '');
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}

		try {
			const fetchUrl = await toFetchableAgentUrl(endpoint, path);
			const response = await fetchAgent(fetchUrl, {
				method: init.method,
				headers,
				body: init.body,
				cache: 'no-store',
				credentials: 'omit'
			});

			if (!response.ok) {
				const body = await response.text();
				throw new Error(body || `HTTP ${response.status} em ${path}`);
			}

			return response.json() as Promise<T>;
		} catch (error) {
			throw new Error(formatAgentFetchError(endpoint, path, error));
		}
	}

}

/** Ex.: /webeditor ou /webeditor-live (--server-base-path). */
function detectServerBasePath(): string {
	const pathname = (globalThis as { location?: { pathname?: string } }).location?.pathname ?? '';
	const webeditor = pathname.match(/^(\/webeditor(?:-live)?)(?:\/|$)/i);
	if (webeditor) {
		return webeditor[1];
	}
	const beforeOut = pathname.indexOf('/out/');
	if (beforeOut > 0) {
		return pathname.slice(0, beforeOut);
	}
	return '';
}

let agentClientOutput: vscode.OutputChannel | undefined;

function logAgentClientWarn(message: string): void {
	try {
		agentClientOutput ??= vscode.window.createOutputChannel('Princy Ai');
		agentClientOutput.appendLine(message);
	} catch {
		// tests / early load
	}
}

/** Code Web: asExternalUri para fetch no worker da extensao (mesmo dominio HTTPS). */
async function toFetchableAgentUrl(endpoint: string, path: string): Promise<string> {
	const url = `${endpoint.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
	if (vscode.env.uiKind !== vscode.UIKind.Web) {
		return url;
	}
	try {
		const external = await vscode.env.asExternalUri(vscode.Uri.parse(url));
		return external.toString(true);
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		logAgentClientWarn(`asExternalUri falhou para ${url}: ${detail}`);
		return url;
	}
}

function toAbsoluteAgentEndpoint(endpoint: string): string {
	const trimmed = endpoint.replace(/\/+$/, '');
	if (!trimmed.startsWith('/')) {
		return trimmed;
	}
	const origin = (globalThis as { location?: { origin?: string } }).location?.origin
		?? getConfiguredPublicWebOrigin();
	if (!origin) {
		return trimmed;
	}
	return `${origin}${trimmed}`;
}

function buildWebApiCandidates(): readonly string[] {
	const candidates: string[] = [...getPreferredWebApiBases()];
	const location = (globalThis as { location?: { origin?: string; hostname?: string; protocol?: string } }).location;
	const basePath = detectServerBasePath() || getConfiguredServerBasePath();
	const remotePublic = Boolean(
		location?.hostname
		&& !isLocalDevHostname(location.hostname)
		&& (location.protocol === 'https:' || location.hostname.includes('.'))
	);

	const pushOrigin = (origin: string) => {
		const o = origin.replace(/\/+$/, '');
		candidates.push(`${o}${SAME_ORIGIN_PROXY_PATH}`);
		if (basePath) {
			candidates.push(`${o}${basePath}${SAME_ORIGIN_PROXY_PATH}`);
		}
	};

	const pageOrigin = location?.origin;
	if (pageOrigin && !candidates.some(c => c.startsWith(pageOrigin))) {
		pushOrigin(pageOrigin);
	}

	if (!remotePublic) {
		candidates.push(SAME_ORIGIN_PROXY_PATH);
		const host = location?.hostname ?? '127.0.0.1';
		if (basePath) {
			candidates.push(`http://${host}:3200${basePath}${SAME_ORIGIN_PROXY_PATH}`);
		}
		candidates.push(`http://${host}:3200${SAME_ORIGIN_PROXY_PATH}`);
		candidates.push(`http://127.0.0.1:3200${SAME_ORIGIN_PROXY_PATH}`);
		if (basePath) {
			candidates.push(`http://127.0.0.1:3200${basePath}${SAME_ORIGIN_PROXY_PATH}`);
		}
		candidates.push(`http://108.181.169.40:3200${SAME_ORIGIN_PROXY_PATH}`);
	}

	return [...new Set(candidates)];
}

function formatAgentFetchError(endpoint: string, path: string, error: unknown): string {
	if (error instanceof Error && error.message.startsWith('Backend ')) {
		return error.message;
	}

	const detail = error instanceof Error ? error.message : String(error);
	const lower = detail.toLowerCase();

	if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('unreachable')) {
		return [
			`Sem conexao com a API em ${endpoint}${path}.`,
			'No VPS: inicie o agent backend (porta 3210) e reinicie o Code Web.',
			'Script: deploy\\windows\\agent-backend\\start-princy-agent-backend.ps1',
			'Teste: http://108.181.169.40:3210/api/health (no VPS) ou /princy-api/api/health no mesmo host do editor.'
		].join(' ');
	}

	return detail;
}
