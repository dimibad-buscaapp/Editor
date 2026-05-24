import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

type AutomationSession = {
	readonly slug: string;
	readonly projectPath: string;
	process: ChildProcess;
	readonly startedAt: number;
};

const sessions = new Map<string, AutomationSession>();

export function getAutomationSession(slug: string): AutomationSession | undefined {
	return sessions.get(slug);
}

export async function startAutomationProcess(slug: string, projectPath: string): Promise<{ alreadyRunning: boolean }> {
	const existing = sessions.get(slug);
	if (existing && !existing.process.killed) {
		return { alreadyRunning: true };
	}

	const pkgPath = path.join(projectPath, 'package.json');
	if (!fs.existsSync(pkgPath)) {
		throw new Error('Projeto sem package.json — use run PowerShell');
	}
	const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
	const script = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).scripts?.dev ? 'dev' : 'start';
	const child = spawn(npm, ['run', script], {
		cwd: projectPath,
		env: process.env,
		shell: process.platform === 'win32',
		stdio: 'ignore',
		detached: false
	});

	sessions.set(slug, { slug, projectPath, process: child, startedAt: Date.now() });
	child.on('exit', () => sessions.delete(slug));
	await new Promise<void>(resolve => setTimeout(resolve, 1500));
	return { alreadyRunning: false };
}

export function stopAutomationProcess(slug: string): boolean {
	const session = sessions.get(slug);
	if (!session) {
		return false;
	}
	session.process.kill('SIGTERM');
	sessions.delete(slug);
	return true;
}

export function listRunningAutomations(): readonly string[] {
	return [...sessions.keys()];
}
