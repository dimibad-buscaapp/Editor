import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export type RunResult = {
	readonly exitCode: number;
	readonly stdout: string;
	readonly stderr: string;
	readonly durationMs: number;
};

function findPowerShellScript(projectPath: string): string {
	const candidates = [
		path.join(projectPath, 'run.ps1'),
		path.join(projectPath, 'scripts', 'main.ps1'),
		path.join(projectPath, 'main.ps1')
	];
	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}
	throw new Error('Script PowerShell nao encontrado (run.ps1 ou scripts/main.ps1)');
}

export async function runPowerShellScript(projectPath: string, scriptPath?: string): Promise<RunResult> {
	const script = scriptPath ?? findPowerShellScript(projectPath);
	if (!fs.existsSync(script)) {
		throw new Error(`Script nao encontrado: ${script}`);
	}
	const startedAt = Date.now();
	const exe = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
	const args = process.platform === 'win32'
		? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script]
		: ['-NoProfile', '-File', script];

	return new Promise(resolve => {
		let stdout = '';
		let stderr = '';
		const child = spawn(exe, args, {
			cwd: projectPath,
			shell: false,
			env: process.env
		});
		child.stdout?.on('data', chunk => { stdout += String(chunk); });
		child.stderr?.on('data', chunk => { stderr += String(chunk); });
		child.on('close', code => {
			resolve({
				exitCode: code ?? 1,
				stdout,
				stderr,
				durationMs: Date.now() - startedAt
			});
		});
		child.on('error', error => {
			resolve({
				exitCode: 1,
				stdout,
				stderr: `${stderr}\n${error.message}`.trim(),
				durationMs: Date.now() - startedAt
			});
		});
	});
}
