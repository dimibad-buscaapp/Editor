/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { subscribeAgentJobStream, type AgentJobStreamHandlers } from './agentJobStream';

interface FetchResponse {
	readonly ok: boolean;
	text(): Promise<string>;
	json(): Promise<unknown>;
}

declare const fetch: (input: string, init?: { readonly method?: string; readonly headers?: Record<string, string>; readonly body?: string }) => Promise<FetchResponse>;

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

const DEFAULT_AGENT_ENDPOINT = 'http://127.0.0.1:3210';
const SAME_ORIGIN_PROXY_PATH = '/princy-api';

let cachedAgentEndpoint: string | undefined;

export class AgentClient {
	public clearEndpointCache(): void {
		cachedAgentEndpoint = undefined;
	}

	/** Detecta a melhor URL da API (proxy mesma origem, localhost ou config manual). */
	public async resolveEndpoint(): Promise<string> {
		if (cachedAgentEndpoint) {
			return cachedAgentEndpoint;
		}

		const configuration = vscode.workspace.getConfiguration('princyai');
		const configured = (configuration.get<string>('agentEndpoint', '') ?? '').trim();
		const useSameOrigin = configuration.get<boolean>('useSameOriginApi', true);

		if (configured && configured !== 'auto' && configured !== DEFAULT_AGENT_ENDPOINT) {
			cachedAgentEndpoint = configured.replace(/\/+$/, '');
			return cachedAgentEndpoint;
		}

		if (vscode.env.uiKind === vscode.UIKind.Web) {
			if (useSameOrigin) {
				const candidates = buildWebApiCandidates();
				for (const base of candidates) {
					if (await this.probeEndpoint(base)) {
						cachedAgentEndpoint = base.replace(/\/+$/, '');
						return cachedAgentEndpoint;
					}
				}
				// Mesmo se o probe falhar no boot, use proxy relativo (porta 3200 -> 3210 no servidor)
				cachedAgentEndpoint = SAME_ORIGIN_PROXY_PATH;
				return cachedAgentEndpoint;
			}
		} else if (await this.probeEndpoint(DEFAULT_AGENT_ENDPOINT)) {
			cachedAgentEndpoint = DEFAULT_AGENT_ENDPOINT;
			return cachedAgentEndpoint;
		}

		cachedAgentEndpoint = (configured && configured !== 'auto' ? configured : DEFAULT_AGENT_ENDPOINT).replace(/\/+$/, '');
		return cachedAgentEndpoint;
	}

	public getAgentEndpoint(): string {
		return cachedAgentEndpoint ?? this.getConfiguredEndpoint();
	}

	private getConfiguredEndpoint(): string {
		return (vscode.workspace.getConfiguration('princyai').get<string>('agentEndpoint', DEFAULT_AGENT_ENDPOINT) ?? DEFAULT_AGENT_ENDPOINT)
			.replace(/\/+$/, '');
	}

	private async probeEndpoint(base: string): Promise<boolean> {
		const normalized = base.replace(/\/+$/, '');
		const paths = ['/api/agent/health', '/api/health', '/'];
		for (const path of paths) {
			try {
				const response = await fetch(`${normalized}${path}`, { method: 'GET' });
				if (response.ok) {
					return true;
				}
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
		const endpoint = await this.resolveEndpoint();
		const token = vscode.workspace.getConfiguration('princyai').get<string>('apiToken', '');
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}

		try {
			const response = await fetch(`${endpoint}${path}`, {
				method: init.method,
				headers,
				body: init.body
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

function buildWebApiCandidates(): readonly string[] {
	const candidates: string[] = [SAME_ORIGIN_PROXY_PATH];
	const location = (globalThis as { location?: { origin?: string; hostname?: string } }).location;
	if (location?.origin) {
		candidates.push(`${location.origin}${SAME_ORIGIN_PROXY_PATH}`);
	}
	if (location?.hostname) {
		candidates.push(`http://${location.hostname}:3200${SAME_ORIGIN_PROXY_PATH}`);
		candidates.push(`https://${location.hostname}${SAME_ORIGIN_PROXY_PATH}`);
	}
	candidates.push(`http://127.0.0.1:3200${SAME_ORIGIN_PROXY_PATH}`);
	return candidates;
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
			'Teste: http://127.0.0.1:3210/api/health (no servidor) ou /princy-api/api/health no mesmo host do editor.'
		].join(' ');
	}

	return detail;
}
