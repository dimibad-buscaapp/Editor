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

export async function checkAgentBackend(client: AgentClient): Promise<BackendStatus> {
	const endpoint = client.getAgentEndpoint();
	try {
		const health = await client.agentHealth();
		return {
			online: true,
			endpoint,
			message: `Backend online (${endpoint})`,
			build: health.build
		};
	} catch (error) {
		return {
			online: false,
			endpoint,
			message: formatConnectivityError(endpoint, error)
		};
	}
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

	return `Backend ${endpoint}: ${detail}`;
}
