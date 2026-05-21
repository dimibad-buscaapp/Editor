/*---------------------------------------------------------------------------------------------
 *  Princy Ai — in-memory request log for /logs UI (VPS debugging).
 *--------------------------------------------------------------------------------------------*/

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
	entries.unshift({
		at: new Date().toISOString(),
		...entry
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
