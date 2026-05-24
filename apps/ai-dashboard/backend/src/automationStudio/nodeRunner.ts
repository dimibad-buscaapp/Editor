import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export type RunResult = {
	readonly exitCode: number;
	readonly stdout: string;
	readonly stderr: string;
	readonly durationMs: number;
};

function resolveNpmScript(projectPath: string, script: 'start' | 'dev' | 'test'): string {
	const pkgPath = path.join(projectPath, 'package.json');
	if (!fs.existsSync(pkgPath)) {
		throw new Error('package.json nao encontrado');
	}
	const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { scripts?: Record<string, string> };
	if (!pkg.scripts?.[script]) {
		throw new Error(`Script npm run ${script} nao definido`);
	}
	return script;
}

export async function runNpmScript(projectPath: string, script: 'start' | 'dev' | 'test' = 'start'): Promise<RunResult> {
	resolveNpmScript(projectPath, script);
	const startedAt = Date.now();
	const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

	return new Promise(resolve => {
		let stdout = '';
		let stderr = '';
		const child = spawn(npm, ['run', script], {
			cwd: projectPath,
			shell: process.platform === 'win32',
			env: process.env,
			timeout: 120_000
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

export async function runSmokeTest(projectPath: string): Promise<RunResult> {
	const smokePath = path.join(projectPath, 'scripts', 'smoke-test.mjs');
	if (fs.existsSync(smokePath)) {
		const startedAt = Date.now();
		return new Promise(resolve => {
			let stdout = '';
			let stderr = '';
			const child = spawn(process.execPath, [smokePath], {
				cwd: projectPath,
				env: process.env,
				shell: false
			});
			child.stdout?.on('data', chunk => { stdout += String(chunk); });
			child.stderr?.on('data', chunk => { stderr += String(chunk); });
			child.on('close', code => {
				resolve({ exitCode: code ?? 1, stdout, stderr, durationMs: Date.now() - startedAt });
			});
			child.on('error', error => {
				resolve({ exitCode: 1, stdout, stderr: error.message, durationMs: Date.now() - startedAt });
			});
		});
	}
	return runNpmScript(projectPath, 'test').catch(() => runNpmScript(projectPath, 'start'));
}
