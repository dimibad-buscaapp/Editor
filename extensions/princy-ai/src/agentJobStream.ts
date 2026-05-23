/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/// <reference lib="dom" />

import type { ActionRunSnapshot, ChatResponse, ComposerPlan } from './agentClient';

interface FetchResponse {
	readonly ok: boolean;
	readonly body: { getReader(): { read(): Promise<{ done: boolean; value?: Uint8Array }> } } | null;
	text(): Promise<string>;
}

declare const fetch: (input: string, init?: { readonly headers?: Record<string, string> }) => Promise<FetchResponse>;

export interface AgentJobStreamHandlers {
	readonly onDelta: (text: string) => void;
	readonly onState?: (state: string) => void;
	readonly onPhase?: (phase: string, actionRun?: ActionRunSnapshot) => void;
	readonly onComposerPlan?: (plan: ComposerPlan) => void;
	readonly onTasks?: (tasks: ActionRunSnapshot['tasks']) => void;
	readonly onAwaitingApproval?: (actionRun?: ActionRunSnapshot) => void;
	readonly onDone: (response: ChatResponse) => void;
	readonly onError: (message: string) => void;
}

export async function subscribeAgentJobStream(
	endpoint: string,
	apiToken: string,
	jobId: string,
	handlers: AgentJobStreamHandlers
): Promise<void> {
	const headers: Record<string, string> = {};
	if (apiToken) {
		headers.Authorization = `Bearer ${apiToken}`;
	}

	let response: FetchResponse;
	try {
		response = await fetch(`${endpoint}/api/agent/jobs/${encodeURIComponent(jobId)}/stream`, { headers });
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		throw new Error(`SSE indisponivel em ${endpoint}: ${detail}`);
	}
	if (!response.ok) {
		throw new Error(await response.text());
	}

	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error('SSE stream unavailable');
	}

	const decoder = new TextDecoder();
	let buffer = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		if (value) {
			buffer += decoder.decode(value);
		}
		const events = buffer.split('\n\n');
		buffer = events.pop() ?? '';

		for (const event of events) {
			const line = event.split('\n').find(entry => entry.startsWith('data:'));
			if (!line) {
				continue;
			}
			const json = line.slice(5).trim();
			if (!json) {
				continue;
			}
			const payload = JSON.parse(json) as {
				readonly type: string;
				readonly text?: string;
				readonly state?: string;
				readonly phase?: string;
				readonly message?: string;
				readonly response?: ChatResponse;
				readonly plan?: ComposerPlan;
				readonly actionRun?: ActionRunSnapshot;
				readonly tasks?: ActionRunSnapshot['tasks'];
			};

			if (payload.type === 'delta' && payload.text !== undefined) {
				handlers.onDelta(payload.text);
			}
			if (payload.type === 'state' && payload.state) {
				handlers.onState?.(payload.state);
				if (payload.state === 'AWAITING_APPROVAL') {
					handlers.onAwaitingApproval?.(payload.actionRun);
				}
			}
			if (payload.type === 'phase' && payload.phase) {
				handlers.onPhase?.(payload.phase, payload.actionRun);
				if (payload.phase === 'awaiting_approval') {
					handlers.onAwaitingApproval?.(payload.actionRun);
				}
			}
			if (payload.type === 'composerPlan' && payload.plan) {
				handlers.onComposerPlan?.(payload.plan);
			}
			if (payload.type === 'tasks' && payload.tasks) {
				handlers.onTasks?.(payload.tasks);
			}
			if (payload.type === 'done' && payload.response) {
				handlers.onDone(payload.response);
				return;
			}
			if (payload.type === 'error') {
				handlers.onError(payload.message ?? 'Stream failed');
				return;
			}
		}
	}
}
