import { resolveAgentApiBase } from './princyHosts.js';

export type BootTraceLevel = 'access' | 'info' | 'ok' | 'warn' | 'error';

export type BootTraceEntry = {
	readonly id: string;
	readonly at: string;
	readonly elapsedMs: number;
	readonly level: BootTraceLevel;
	readonly phase: string;
	readonly message: string;
	readonly detail?: string;
};

export type LogviewBundle = {
	readonly ok: boolean;
	readonly ts: number;
	readonly trace: readonly BootTraceEntry[];
	readonly runtimeLogs: {
		readonly ok: boolean;
		readonly ts: number;
		readonly projectRoot: string;
		readonly logs: Record<string, readonly string[]>;
	};
	readonly probes: readonly {
		readonly name: string;
		readonly url: string;
		readonly ok: boolean;
		readonly status: number;
		readonly ms: number;
		readonly hint: string;
		readonly bodyPreview: string;
	}[];
	readonly recentRequests: readonly {
		readonly at: string;
		readonly method: string;
		readonly url: string;
		readonly statusCode: number;
		readonly durationMs: number;
	}[];
	readonly copyText?: string;
};

function apiBase(): string {
	if (typeof window === 'undefined') {
		return '/princy-api';
	}
	return resolveAgentApiBase(window.location.hostname, window.location.port);
}

function apiUrl(path: string): string {
	const base = apiBase().replace(/\/$/, '');
	const p = path.startsWith('/') ? path : `/${path}`;
	return `${base}${p}`;
}

export async function fetchLogviewBundle(): Promise<LogviewBundle> {
	const response = await fetch(apiUrl('/api/editor/logview-bundle?lines=100'), { cache: 'no-store' });
	if (!response.ok) {
		throw new Error(`logview-bundle HTTP ${response.status}`);
	}
	return response.json() as Promise<LogviewBundle>;
}

export async function postClientTrace(input: {
	readonly level: BootTraceLevel;
	readonly phase: string;
	readonly message: string;
	readonly detail?: string;
}): Promise<void> {
	await fetch(apiUrl('/api/editor/boot-trace/client'), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify(input)
	});
}

export async function resetServerTrace(): Promise<void> {
	await fetch(apiUrl('/api/editor/boot-trace/reset'), { method: 'POST' });
}
