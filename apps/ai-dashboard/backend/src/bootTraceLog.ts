/*---------------------------------------------------------------------------------------------
 *  Trace detalhado: index (3220) -> webeditor / Code-OSS (3200) — LogView tempo real.
 *--------------------------------------------------------------------------------------------*/

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

const MAX_ENTRIES = 400;
const entries: BootTraceEntry[] = [];
let sessionAnchor = Date.now();

function newId(): string {
	return `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function resetBootTraceSession(): void {
	sessionAnchor = Date.now();
	entries.length = 0;
}

export function appendBootTrace(input: {
	readonly level: BootTraceLevel;
	readonly phase: string;
	readonly message: string;
	readonly detail?: string;
}): BootTraceEntry {
	const row: BootTraceEntry = {
		id: newId(),
		at: new Date().toISOString(),
		elapsedMs: Date.now() - sessionAnchor,
		level: input.level,
		phase: input.phase,
		message: input.message,
		detail: input.detail
	};
	entries.push(row);
	if (entries.length > MAX_ENTRIES) {
		entries.splice(0, entries.length - MAX_ENTRIES);
	}
	return row;
}

export function getBootTrace(limit = 200): readonly BootTraceEntry[] {
	return entries.slice(-Math.min(limit, entries.length));
}

export function formatBootTraceForCopy(limit = 300): string {
	const slice = getBootTrace(limit);
	let out = `# Princy Boot Trace ${new Date().toISOString()}\n\n`;
	for (const row of slice) {
		out += `[${row.at}] +${row.elapsedMs}ms [${row.level}] [${row.phase}] ${row.message}`;
		if (row.detail) {
			out += `\n    ${row.detail}`;
		}
		out += '\n';
	}
	return out;
}
