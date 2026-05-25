/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AgentClient } from './agentClient';

export interface BackendStatus {
	readonly online: boolean;
	readonly endpoint: string;
	readonly message: string;
	readonly build?: string;
}

let lastBackendOnlineAt = 0;

/** Evita reconnect periódico (clearEndpointCache) quando o último health foi OK há pouco. */
export function markBackendConnectivity(online: boolean): void {
	if (online) {
		lastBackendOnlineAt = Date.now();
	} else {
		lastBackendOnlineAt = 0;
	}
}

export function shouldSkipPeriodicReconnect(minIntervalMs = 30_000): boolean {
	return lastBackendOnlineAt > 0 && Date.now() - lastBackendOnlineAt < minIntervalMs;
}

function isHealthOk(health: { readonly ok?: boolean } | undefined): boolean {
	return health?.ok !== false;
}

function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export async function checkAgentBackend(client: AgentClient): Promise<BackendStatus> {
	const retryDelaysMs = [0, 500, 1500];
	let lastStatus: BackendStatus | undefined;

	for (let attempt = 0; attempt < retryDelaysMs.length; attempt++) {
		if (retryDelaysMs[attempt] > 0) {
			await delay(retryDelaysMs[attempt]);
		}

		await client.resolveEndpoint();
		const endpoint = client.getAgentEndpoint();
		const probeNote = client.getLastProbeNote();
		let lastError: unknown;

		for (const probe of [
			() => client.agentHealth(),
			() => client.health()
		]) {
			try {
				const health = await probe();
				if (isHealthOk(health)) {
					const note = probeNote ? ` — ${probeNote}` : '';
					return {
						online: true,
						endpoint,
						message: `Backend online (${endpoint})${note}`,
						build: health.build
					};
				}
			} catch (error) {
				lastError = error;
			}
		}

		lastStatus = {
			online: false,
			endpoint,
			message: formatConnectivityError(endpoint, lastError)
		};
	}

	return lastStatus ?? {
		online: false,
		endpoint: client.getAgentEndpoint(),
		message: 'Backend indisponivel apos varias tentativas.'
	};
}

export function formatConnectivityError(endpoint: string, error: unknown): string {
	const detail = error instanceof Error ? error.message : String(error);
	const lower = detail.toLowerCase();

	if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network request failed')) {
		const fixEndpoint = endpoint.includes('/webeditor/princy-api')
			? 'Corrija: princyai.agentEndpoint = https://princyai.com/princy-api (NAO /webeditor/princy-api).'
			: 'Editor HTTPS: use princyai.agentEndpoint = https://princyai.com/princy-api (nao :3210 nem 127.0.0.1).';
		return [
			`Nao foi possivel conectar ao backend em ${endpoint}.`,
			fixEndpoint,
			'VPS: teste deploy\\windows\\code-web\\test-princy-3200-3210-proxy.ps1',
			'Servicos: PrincyAiAgentBackend (:3210) + PrincyAiCodeWeb (:3200) + Caddy /princy-api.'
		].join(' ');
	}

	if (lower.includes('princy agent backend unreachable') || lower.includes('502')) {
		return [
			`Proxy Code Web (:3200) nao alcanca o agent (:3210) em ${endpoint}.`,
			'Restart-Service PrincyAiAgentBackend; depois PrincyAiCodeWeb.',
			'Teste: http://127.0.0.1:3200/princy-api/api/agent/health'
		].join(' ');
	}

	if (lower.includes('401') || lower.includes('invalid agent api token')) {
		return `Token invalido para ${endpoint}. Ajuste princyai.apiToken ou AGENT_API_TOKEN no .env.`;
	}

	if (lower.includes('not found') || lower.includes('404')) {
		if (endpoint.includes(':3210') && endpoint.includes('princy-api')) {
			return [
				'URL incorreta: /princy-api so existe no Code Web (porta 3200), nao na 3210.',
				'Use princyai.agentEndpoint = http://127.0.0.1:3200/princy-api',
				'Backend direto: http://127.0.0.1:3210/api/health (sem /princy-api).'
			].join(' ');
		}
		if (endpoint.endsWith('/princy-api') || endpoint.endsWith('/princy-api/')) {
			return [
				`404 em ${endpoint} — teste ${endpoint}/api/health (nao so /princy-api).`,
				'Se falhar: recompile o Code Web (npm run compile-incremental) para ativar o proxy /princy-api.',
				'Confirme o agent na 3210: http://127.0.0.1:3210/api/health'
			].join(' ');
		}
	}

	return `Backend ${endpoint}: ${detail}`;
}
