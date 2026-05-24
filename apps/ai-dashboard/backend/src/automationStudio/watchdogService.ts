import { config } from '../config.js';
import { readAutomationManifest, writeAutomationManifest } from './automationManifest.js';

type WatchdogState = {
	running: boolean;
	intervalMs: number;
	lastCheckAt?: number;
	lastOk?: boolean;
	timer?: ReturnType<typeof setInterval>;
};

const state: WatchdogState = {
	running: false,
	intervalMs: Number(process.env.PRINCY_WATCHDOG_INTERVAL_MS ?? '300000')
};

async function probeHealth(): Promise<{ ok: boolean; details: string }> {
	try {
		const res = await fetch(`http://127.0.0.1:${config.apiPort}/api/health`, { signal: AbortSignal.timeout(10_000) });
		if (!res.ok) {
			return { ok: false, details: `health HTTP ${res.status}` };
		}
		const agentRes = await fetch(`http://127.0.0.1:${config.apiPort}/api/agent/health`, { signal: AbortSignal.timeout(10_000) });
		if (!agentRes.ok) {
			return { ok: false, details: `agent health HTTP ${agentRes.status}` };
		}
		return { ok: true, details: 'health + agent OK' };
	} catch (error) {
		return { ok: false, details: error instanceof Error ? error.message : String(error) };
	}
}

async function runWatchdogCheck(): Promise<void> {
	state.lastCheckAt = Date.now();
	const result = await probeHealth();
	state.lastOk = result.ok;

	if (!result.ok && config.orchestratorAutoHeal) {
		try {
			const res = await fetch(`http://127.0.0.1:${config.apiPort}/api/agent/jobs`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(config.agentApiToken ? { Authorization: `Bearer ${config.agentApiToken}` } : {})
				},
				body: JSON.stringify({
					agent: 'debug',
					message: `Watchdog detectou falha: ${result.details}. Verifique servicos Princy e corrija.`,
					mode: 'agent',
					trigger_compile: false,
					skipPostApply: true,
					actionOnlyExplain: true
				}),
				signal: AbortSignal.timeout(30_000)
			});
			if (res.ok) {
				const job = await res.json() as { jobId?: string };
				if (job.jobId) {
					const manifest = readAutomationManifest('_watchdog') ?? {
						slug: '_watchdog',
						type: 'watchdog',
						projectPath: config.editorProjectRoot,
						updatedAt: Date.now()
					};
					writeAutomationManifest({
						...manifest,
						lastHealthCheck: state.lastCheckAt,
						lastFailure: result.details,
						autoHealJobId: job.jobId,
						updatedAt: Date.now()
					});
				}
			}
		} catch {
			// watchdog must not crash server
		}
	} else {
		const manifest = readAutomationManifest('_watchdog') ?? {
			slug: '_watchdog',
			type: 'watchdog',
			projectPath: config.editorProjectRoot,
			updatedAt: Date.now()
		};
		writeAutomationManifest({
			...manifest,
			lastHealthCheck: state.lastCheckAt,
			lastFailure: result.ok ? undefined : result.details,
			updatedAt: Date.now()
		});
	}
}

export function startWatchdog(): void {
	if (state.running) {
		return;
	}
	state.running = true;
	void runWatchdogCheck();
	state.timer = setInterval(() => {
		void runWatchdogCheck();
	}, state.intervalMs);
}

export function stopWatchdog(): void {
	if (state.timer) {
		clearInterval(state.timer);
		state.timer = undefined;
	}
	state.running = false;
}

export function getWatchdogStatus(): { running: boolean; intervalMs: number; lastCheckAt?: number; lastOk?: boolean } {
	return {
		running: state.running,
		intervalMs: state.intervalMs,
		lastCheckAt: state.lastCheckAt,
		lastOk: state.lastOk
	};
}

// Auto-start watchdog on module load when enabled
if ((process.env.PRINCY_AUTOMATION_WATCHDOG ?? 'true').toLowerCase() !== 'false') {
	startWatchdog();
}
