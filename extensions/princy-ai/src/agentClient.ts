/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

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
	readonly openTabs: readonly string[];
	readonly diagnostics: readonly string[];
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

export interface ChatRequest {
	readonly agent: AgentModel;
	readonly message: string;
	readonly filePath?: string;
	readonly selectedText?: string;
	readonly shadowContext?: ShadowContext;
	readonly codeGraph?: CodeGraphContext;
}

export interface ChatResponse {
	readonly message: string;
	readonly suggestedCommands?: readonly string[];
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

export class AgentClient {
	public async inlineEdit(request: InlineEditRequest): Promise<InlineEditResponse> {
		return this.post<InlineEditResponse>('/api/agent/inline-edit', request);
	}

	public async chat(request: ChatRequest): Promise<ChatResponse> {
		return this.post<ChatResponse>('/api/agent/chat', request);
	}

	public async indexFile(request: IndexFileRequest): Promise<void> {
		await this.post<{ ok: boolean }>('/api/agent/index-file', request);
	}

	public async composerPlan(request: ComposerPlanRequest): Promise<ComposerPlan> {
		return this.post<ComposerPlan>('/api/agent/composer-plan', request);
	}

	public async repairAfterCommand(request: RepairAfterCommandRequest): Promise<ComposerPlan> {
		return this.post<ComposerPlan>('/api/agent/repair-after-command', request);
	}

	private async post<T>(path: string, body: unknown): Promise<T> {
		const endpoint = this.getEndpoint();
		const token = vscode.workspace.getConfiguration('princyai').get<string>('apiToken', '');
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}

		const response = await fetch(`${endpoint}${path}`, {
			method: 'POST',
			headers,
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			throw new Error(await response.text());
		}

		return response.json() as Promise<T>;
	}

	private getEndpoint(): string {
		const configured = vscode.workspace.getConfiguration('princyai').get<string>('agentEndpoint', 'http://127.0.0.1:3210');
		return configured.replace(/\/+$/, '');
	}
}
