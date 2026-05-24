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

function isHealthOk(health: { readonly ok?: boolean } | undefined): boolean {
	return health?.ok !== false;
}

export async function checkAgentBackend(client: AgentClient): Promise<BackendStatus> {
	await client.resolveEndpoint();
	const endpoint = client.getAgentEndpoint();
	let lastError: unknown;

	for (const probe of [
		() => client.agentHealth(),
		() => client.health()
	]) {
		try {
			const health = await probe();
			if (isHealthOk(health)) {
				return {
					online: true,
					endpoint,
					message: `Backend online (${endpoint})`,
					build: health.build
				};
			}
		} catch (error) {
			lastError = error;
		}
	}

	return {
		online: false,
		endpoint,
		message: formatConnectivityError(endpoint, lastError)
	};
}

export function formatConnectivityError(endpoint: string, error: unknown): string {
	const detail = error instanceof Error ? error.message : String(error);
	const lower = detail.toLowerCase();

	if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network request failed')) {
		return [
			`Nao foi possivel conectar ao backend em ${endpoint}.`,
			'1) Inicie o agent backend: deploy\\windows\\agent-backend\\start-princy-agent-backend.ps1',
			'2) Confirme APP_ORIGIN=http://127.0.0.1:3200 no .env do backend (CORS).',
			'3) Se o editor for HTTPS, use proxy HTTPS para a porta 3210 ou princyai.agentEndpoint apontando para URL segura.',
			'4) Verifique firewall/antivirus bloqueando localhost:3210.'
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
