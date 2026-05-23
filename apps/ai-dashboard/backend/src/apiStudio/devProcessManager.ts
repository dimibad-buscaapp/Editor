import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { detectPort } from './apiStudioService.js';

type DevSession = {
	readonly slug: string;
	readonly projectPath: string;
	readonly port: number;
	process: ChildProcess;
};

const sessions = new Map<string, DevSession>();

export function getDevSession(slug: string): DevSession | undefined {
	return sessions.get(slug);
}

export async function startDevServer(slug: string, projectPath: string): Promise<{ port: number; alreadyRunning: boolean }> {
	const existing = sessions.get(slug);
	if (existing && !existing.process.killed) {
		return { port: existing.port, alreadyRunning: true };
	}

	const port = detectPort(projectPath);
	const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
	const child = spawn(npm, ['run', 'dev'], {
		cwd: projectPath,
		env: { ...process.env, PORT: String(port) },
		shell: process.platform === 'win32',
		stdio: 'ignore',
		detached: false
	});

	sessions.set(slug, { slug, projectPath, port, process: child });
	child.on('exit', () => {
		sessions.delete(slug);
	});

	await new Promise<void>(resolve => setTimeout(resolve, 2500));
	return { port, alreadyRunning: false };
}

export function stopDevServer(slug: string): boolean {
	const session = sessions.get(slug);
	if (!session) {
		return false;
	}
	session.process.kill('SIGTERM');
	sessions.delete(slug);
	return true;
}

export async function fetchOpenApiSpec(baseUrl: string, stack: 'fastify' | 'express' | 'unknown'): Promise<unknown> {
	const paths = stack === 'express'
		? ['/openapi.json']
		: ['/docs/json', '/documentation/json'];
	const base = baseUrl.replace(/\/+$/, '');
	for (const p of paths) {
		try {
			const res = await fetch(`${base}${p}`);
			if (res.ok) {
				return await res.json();
			}
		} catch {
			// try next
		}
	}
	throw new Error('OpenAPI nao disponivel. Inicie o servidor (npm run dev) e confira /docs');
}
