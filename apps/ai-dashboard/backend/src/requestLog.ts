/*---------------------------------------------------------------------------------------------
 *  Princy Ai — in-memory request log for /logs UI (VPS debugging).
 *--------------------------------------------------------------------------------------------*/

import { appendBootTrace } from './bootTraceLog.js';

export type RequestLogEntry = {
	readonly at: string;
	readonly method: string;
	readonly url: string;
	readonly statusCode: number;
	readonly durationMs: number;
	readonly error?: string;
};

const MAX_ENTRIES = 200;
const entries: RequestLogEntry[] = [];

export function recordRequest(entry: Omit<RequestLogEntry, 'at'>): void {
	const row = {
		at: new Date().toISOString(),
		...entry
	};
	entries.unshift(row);
	appendBootTrace({
		level: entry.statusCode >= 500 ? 'error' : entry.statusCode >= 400 ? 'warn' : 'access',
		phase: 'api-backend',
		message: `${entry.method} ${entry.url}`,
		detail: `HTTP ${entry.statusCode} · ${entry.durationMs}ms`
	});
	if (entries.length > MAX_ENTRIES) {
		entries.length = MAX_ENTRIES;
	}
}

export function getRecentRequestLogs(limit = 100): readonly RequestLogEntry[] {
	return entries.slice(0, Math.min(limit, entries.length));
}

export function clearRequestLogs(): void {
	entries.length = 0;
}
