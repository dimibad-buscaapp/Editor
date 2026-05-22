/*---------------------------------------------------------------------------------------------
 *  Checklist do boot: index (3220) -> API (3210) -> Code Web (3200) - pagina /logview
 *--------------------------------------------------------------------------------------------*/

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { config } from './config.js';
import { readRuntimeLogs } from './editorRuntimeLog.js';

const execFileAsync = promisify(execFile);

export type StarterStepStatus = 'pending' | 'running' | 'ok' | 'warn' | 'error';

export type StarterStep = {
	readonly id: string;
	readonly order: number;
	readonly label: string;
	readonly status: StarterStepStatus;
	readonly detail: string;
	readonly logLines: readonly string[];
};

const PRINCY_SERVICES = [
	'PrincyCaddy',
	'PrincyAiIndex',
	'PrincyAiAgentBackend',
	'PrincyAiCodeWeb'
] as const;

function psLine(text: string): string {
	return text;
}

async function queryWindowsService(name: string): Promise<{ readonly running: boolean; readonly detail: string; readonly lines: readonly string[] }> {
	const lines: string[] = [psLine(`PS> Get-Service -Name ${name}`)];
	try {
		const { stdout } = await execFileAsync('sc', ['query', name], {
			windowsHide: true,
			timeout: 12_000,
			maxBuffer: 64 * 1024
		});
		const text = String(stdout);
		lines.push(...text.split(/\r?\n/).filter(l => l.trim().length > 0).map(l => `    ${l.trimEnd()}`));
		const running = /STATE\s+:\s+\d+\s+RUNNING/i.test(text);
		return {
			running,
			detail: running ? 'RUNNING' : 'NOT RUNNING ou parado',
			lines
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		lines.push(`    [ERRO] ${message}`);
		return { running: false, detail: message, lines };
	}
}

async function probePort(port: number): Promise<{ readonly ok: boolean; readonly detail: string; readonly lines: readonly string[] }> {
	const lines: string[] = [psLine(`PS> Test-NetConnection -ComputerName 127.0.0.1 -Port ${port}`)];
	try {
		const { stdout } = await execFileAsync('powershell.exe', [
			'-NoProfile',
			'-Command',
			`(Test-NetConnection -ComputerName 127.0.0.1 -Port ${port} -WarningAction SilentlyContinue).TcpTestSucceeded`
		], { windowsHide: true, timeout: 15_000, maxBuffer: 32 * 1024 });
		const ok = String(stdout).trim().toLowerCase() === 'true';
		lines.push(`    TcpTestSucceeded : ${ok}`);
		return { ok, detail: ok ? `Porta ${port} aberta` : `Porta ${port} fechada`, lines };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		lines.push(`    [ERRO] ${message}`);
		return { ok: false, detail: message, lines };
	}
}

function slugId(prefix: string, label: string): string {
	return `${prefix}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

/** HTML servido em producao nao contem o literal WORKBENCH_WEB_CONFIGURATION (substituido por JSON). */
function htmlHasWorkbenchBoot(text: string): boolean {
	return /vscode-workbench-web-configuration/i.test(text)
		|| /"serverBasePath"/.test(text)
		|| /workbench\/workbench\.js/i.test(text)
		|| /WORKBENCH_WEB_CONFIGURATION/.test(text);
}

async function probeHttp(label: string, url: string, expectWorkbench = false): Promise<StarterStep> {
	const id = slugId('http', label);
	const lines: string[] = [psLine(`PS> Invoke-WebRequest -Uri '${url}' -UseBasicParsing`)];
	const t0 = Date.now();
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 12_000);
		const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'text/html,*/*' } });
		clearTimeout(timeout);
		const ms = Date.now() - t0;
		const text = await response.text();
		const preview = text.slice(0, 120).replace(/\s+/g, ' ');
		lines.push(`    StatusCode : ${response.status}`);
		lines.push(`    Tempo      : ${ms} ms`);
		lines.push(`    Preview    : ${preview}`);
		let ok = response.ok;
		let detail = `HTTP ${response.status} em ${ms}ms`;
		if (expectWorkbench) {
			const hasWb = htmlHasWorkbenchBoot(text);
			lines.push(`    Workbench  : ${hasWb ? 'meta vscode-workbench-web-configuration / serverBasePath OK' : 'NAO encontrado no HTML'}`);
			ok = ok && hasWb;
			if (!hasWb) {
				detail += ' - HTML sem boot do workbench (compile ou base path?)';
			}
		}
		return {
			id,
			order: 0,
			label,
			status: ok ? 'ok' : response.ok ? 'warn' : 'error',
			detail,
			logLines: lines
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		lines.push(`    [ERRO] ${message}`);
		return { id, order: 0, label, status: 'error', detail: message, logLines: lines };
	}
}

function checkFileOnDisk(relativeOut: string, label: string, severity: 'error' | 'warn' = 'error'): StarterStep {
	const full = path.join(config.editorProjectRoot, relativeOut);
	const id = slugId('file', label);
	const lines = [psLine(`PS> Test-Path '${full}'`)];
	const exists = fs.existsSync(full);
	lines.push(`    ${exists ? 'True' : 'False'}`);
	return {
		id,
		order: 0,
		label,
		status: exists ? 'ok' : severity,
		detail: exists ? 'Encontrado' : `Ausente: ${full}`,
		logLines: lines
	};
}

function checkAnyFileOnDisk(paths: readonly string[], label: string): StarterStep {
	const lines: string[] = [];
	let found: string | undefined;
	for (const relativeOut of paths) {
		const full = path.join(config.editorProjectRoot, relativeOut);
		lines.push(psLine(`PS> Test-Path '${full}'`));
		const exists = fs.existsSync(full);
		lines.push(`    ${exists ? 'True' : 'False'}`);
		if (exists && !found) {
			found = relativeOut;
		}
	}
	return {
		id: slugId('file', label),
		order: 0,
		label,
		status: found ? 'ok' : 'error',
		detail: found ? `Encontrado: ${found}` : `Ausente: ${paths.join(' ou ')}`,
		logLines: lines
	};
}

function scanStarterErrors(logs: ReturnType<typeof readRuntimeLogs>): StarterStep {
	const lines: string[] = [psLine('PS> Get-Content .\\logs\\code-web.err.log -Tail 30')];
	const errLog = logs.logs['code-web.err.log'] ?? [];
	const bad = errLog.filter(l =>
		/error|fatal|exception|ENOENT|EADDRINUSE|Cannot find|parse error/i.test(l)
	);
	for (const line of errLog.slice(-30)) {
		lines.push(`    ${line}`);
	}
	const status: StarterStepStatus = bad.length === 0 ? (errLog.length === 0 ? 'warn' : 'ok') : 'error';
	return {
		id: 'starter-err-log',
		order: 0,
		label: 'Analisar code-web.err.log (starter)',
		status,
		detail: bad.length === 0
			? 'Sem erros criticos nas ultimas linhas'
			: `${bad.length} linha(s) com erro - veja terminal`,
		logLines: lines
	};
}

export async function runStarterChecklist(): Promise<{
	readonly ok: boolean;
	readonly ts: number;
	readonly steps: readonly StarterStep[];
	readonly terminal: readonly string[];
	readonly systemLogs: ReturnType<typeof readRuntimeLogs>;
	readonly hints: readonly string[];
}> {
	const terminal: string[] = [];
	const steps: StarterStep[] = [];
	let order = 0;

	const push = (step: StarterStep): void => {
		order += 1;
		steps.push({ ...step, order });
		for (const line of step.logLines) {
			terminal.push(line);
		}
		terminal.push('');
	};

	terminal.push('Windows PowerShell');
	terminal.push('Copyright (C) Princy Starter Diagnostic');
	terminal.push('');
	terminal.push(psLine('PS> Write-Host "=== Boot: Index -> API -> Code Web ===" -ForegroundColor Cyan'));
	terminal.push('');

	for (const svc of PRINCY_SERVICES) {
		const r = await queryWindowsService(svc);
		push({
			id: `svc-${svc}`,
			order: 0,
			label: `Servico Windows: ${svc}`,
			status: r.running ? 'ok' : 'error',
			detail: r.detail,
			logLines: r.lines
		});
	}

	for (const port of [3220, 3210, 3200] as const) {
		const r = await probePort(port);
		push({
			id: `port-${port}`,
			order: 0,
			label: `Porta TCP ${port}`,
			status: r.ok ? 'ok' : 'error',
			detail: r.detail,
			logLines: r.lines
		});
	}

	const host = config.princyVpsHost;
	const base = config.editorBasePath;
	push(await probeHttp('HTTP landing index :3220', `http://127.0.0.1:${config.indexPort}/`));
	push(await probeHttp('HTTP API health :3210', `http://127.0.0.1:${config.apiPort}/api/agent/health`));
	push(await probeHttp('HTTP public /princy-api health', 'https://princyai.com/princy-api/api/agent/health'));
	push(await probeHttp('HTTP Code Web /webeditor/', `http://127.0.0.1:3200${base}/`, true));
	push(await probeHttp('HTTPS public /webeditor/', `https://princyai.com${base}/`, true));

	push(checkFileOnDisk('out\\vs\\code\\browser\\workbench\\workbench.html', 'Ficheiro workbench.html (producao)'));
	push(checkAnyFileOnDisk(
		[
			'out\\vs\\code\\browser\\workbench\\workbench.js',
			'out\\vs\\code\\browser\\workbench\\workbench.css',
			'out\\vs\\workbench\\workbench.web.main.css'
		],
		'Bundle workbench (js ou css)'
	));
	push(checkFileOnDisk('out\\server-main.js', 'Ficheiro server-main.js (node starter)'));
	push(checkFileOnDisk('out\\vs\\workbench\\workbench.web.main.css', 'CSS legado workbench.web.main.css (opcional)', 'warn'));

	const staticBase = `${base}/static`;
	push(await probeHttp(
		'HTTP asset workbench.js',
		`http://127.0.0.1:3200${staticBase}/out/vs/code/browser/workbench/workbench.js`
	));
	push(await probeHttp(
		'HTTP asset workbench.css',
		`http://127.0.0.1:3200${staticBase}/out/vs/code/browser/workbench/workbench.css`
	));

	const systemLogs = readRuntimeLogs(60);
	push(scanStarterErrors(systemLogs));

	const failed = steps.filter(s => s.status === 'error');
	const hints: string[] = [];
	if (failed.some(s => s.id.startsWith('svc-PrincyAiCodeWeb'))) {
		hints.push('PrincyAiCodeWeb parado: rode deploy\\windows\\code-web\\fix-princy-code-web-service.ps1 como Admin.');
	}
	if (failed.some(s => s.label.includes('workbench.html'))) {
		hints.push('Compile producao: deploy\\windows\\code-web\\compile-princy-code-web-production.ps1');
	}
	if (failed.some(s => s.id === 'starter-err-log')) {
		hints.push('Erros no code-web.err.log - abra logs\\code-web.err.log no VPS ou copie o terminal abaixo.');
	}
	if (failed.some(s => s.label.includes('HTTPS public'))) {
		hints.push('Caddy/firewall: deploy\\windows\\code-web\\fix-princy-caddy.ps1 e confirme 443 aberta.');
	}

	return {
		ok: failed.length === 0,
		ts: Date.now(),
		steps,
		terminal,
		systemLogs,
		hints
	};
}

export async function* streamStarterChecklist(): AsyncGenerator<{ readonly type: string; readonly data?: unknown }> {
	yield { type: 'banner', data: { text: 'Windows PowerShell — Princy Starter Log (sistema)' } };
	const result = await runStarterChecklist();
	for (const step of result.steps) {
		yield { type: 'step', data: step };
		for (const line of step.logLines) {
			yield { type: 'line', data: { text: line } };
		}
		yield { type: 'line', data: { text: '' } };
	}
	yield { type: 'done', data: { ok: result.ok, hints: result.hints, systemLogs: result.systemLogs } };
}
