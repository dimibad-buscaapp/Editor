/*---------------------------------------------------------------------------------------------
 *  Princy Ai — public diagnostic bundle for https://dashboard.princyai.com/logs
 *--------------------------------------------------------------------------------------------*/

import { config } from './config.js';
import { prisma } from './prisma.js';
import { getRecentRequestLogs } from './requestLog.js';

export type DiagnosticCheck = {
	readonly id: string;
	readonly label: string;
	readonly ok: boolean;
	readonly detail: string;
};

export type DiagnosticReport = {
	readonly generatedAt: string;
	readonly appOrigin: string;
	readonly codeWebUrl: string;
	readonly apiPort: number;
	readonly checks: readonly DiagnosticCheck[];
	readonly recentRequests: ReturnType<typeof getRecentRequestLogs>;
	readonly hints: readonly string[];
};

async function probeUrl(label: string, url: string, path: string): Promise<DiagnosticCheck> {
	const target = `${url.replace(/\/+$/, '')}${path}`;
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 8000);
		const response = await fetch(target, { signal: controller.signal });
		clearTimeout(timeout);
		return {
			id: label,
			label,
			ok: response.ok,
			detail: `${target} → HTTP ${response.status}`
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { id: label, label, ok: false, detail: `${target} → ${message}` };
	}
}

export async function buildDiagnosticReport(): Promise<DiagnosticReport> {
	const checks: DiagnosticCheck[] = [];

	try {
		await prisma.$queryRaw`SELECT 1`;
		checks.push({ id: 'postgres', label: 'PostgreSQL', ok: true, detail: 'Connected' });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		checks.push({ id: 'postgres', label: 'PostgreSQL', ok: false, detail: message });
	}

	checks.push(await probeUrl('ollama', config.ollamaBaseUrl, '/api/tags'));
	checks.push(await probeUrl('agent-health', `http://127.0.0.1:${config.apiPort}`, '/api/health'));
	checks.push(await probeUrl('agent-models', `http://127.0.0.1:${config.apiPort}`, '/api/agent/models'));
	checks.push(await probeUrl('code-web', config.codeWebUrl, '/'));
	checks.push(await probeUrl('code-web-proxy', config.codeWebInternalUrl, '/princy-api/api/health'));

	const hints: string[] = [];
	if (!checks.find(c => c.id === 'code-web')?.ok) {
		hints.push(`Editor em ${config.codeWebUrl}/ — confira --server-base-path ${config.editorBasePath} e Caddy handle /webeditor* (nao handle_path).`);
	}
	if (!checks.find(c => c.id === 'code-web-proxy')?.ok) {
		hints.push('Proxy /princy-api no Code Web (3200): rode npm run compile-incremental na raiz do Editor e reinicie o Code Web.');
	}
	if (!checks.find(c => c.id === 'ollama')?.ok) {
		hints.push('Ollama offline: instale/inicie Ollama e puxe o modelo (ollama pull deepseek-coder).');
	}
	if (!checks.find(c => c.id === 'postgres')?.ok) {
		hints.push('PostgreSQL: confira DATABASE_URL no .env e docker/postgres na 5432.');
	}

	return {
		generatedAt: new Date().toISOString(),
		appOrigin: config.appOrigin,
		codeWebUrl: config.codeWebUrl,
		apiPort: config.apiPort,
		checks,
		recentRequests: getRecentRequestLogs(80),
		hints
	};
}
