/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export interface InlineEditRequest {
	readonly instruction: string;
	readonly selectedText: string;
	readonly languageId: string;
	readonly filePath: string;
}

export interface InlineEditResponse {
	readonly replacement: string;
	readonly explanation?: string;
}

export interface ChatRequest {
	readonly message: string;
	readonly filePath?: string;
	readonly selectedText?: string;
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
