import { getBootTrace, formatBootTraceForCopy } from './bootTraceLog.js';
import { probeEditorStack, type StackProbe } from './editorProbes.js';
import { readRuntimeLogs } from './editorRuntimeLog.js';
import { getRecentRequestLogs } from './requestLog.js';

function formatProbesForCopy(probes: readonly StackProbe[]): string {
	let out = '\n## Probes VPS (3220 / 3200 / 3210 / HTTPS)\n\n';
	for (const p of probes) {
		out += `${p.ok ? 'OK' : 'FAIL'} ${p.name} — HTTP ${p.status} ${p.ms}ms\n`;
		out += `  URL: ${p.url}\n  ${p.hint}\n`;
		if (p.bodyPreview) {
			out += `  preview: ${p.bodyPreview.slice(0, 240).replace(/\n/g, ' ')}\n`;
		}
	}
	return out;
}

function formatRuntimeForCopy(runtime: ReturnType<typeof readRuntimeLogs>): string {
	let out = '\n## Arquivos de log (NSSM / Code Web)\n\n';
	for (const [name, lines] of Object.entries(runtime.logs)) {
		out += `### ${name}\n`;
		for (const line of lines.slice(-40)) {
			out += `${line}\n`;
		}
		out += '\n';
	}
	return out;
}

export function formatLogviewBundleForCopy(input: {
	readonly trace: ReturnType<typeof getBootTrace>;
	readonly probes: readonly StackProbe[];
	readonly runtimeLogs: ReturnType<typeof readRuntimeLogs>;
	readonly recentRequests: ReturnType<typeof getRecentRequestLogs>;
}): string {
	let out = formatBootTraceForCopy(300);
	out += formatProbesForCopy(input.probes);
	out += formatRuntimeForCopy(input.runtimeLogs);
	out += '\n## Ultimas requisicoes API (3210)\n\n';
	for (const r of input.recentRequests.slice(0, 40)) {
		out += `[${r.at}] ${r.method} ${r.url} → ${r.statusCode} (${r.durationMs}ms)\n`;
	}
	return out;
}

export async function buildLogviewBundle(lines = 80) {
	const runtimeLogs = readRuntimeLogs(lines);
	const probes = await probeEditorStack();
	const trace = getBootTrace(250);
	const recentRequests = getRecentRequestLogs(80);
	return {
		ok: true,
		ts: Date.now(),
		trace,
		runtimeLogs,
		probes: probes.probes,
		recentRequests,
		copyText: formatLogviewBundleForCopy({ trace, probes: probes.probes, runtimeLogs, recentRequests })
	};
}
