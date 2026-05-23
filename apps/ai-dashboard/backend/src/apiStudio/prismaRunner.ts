import { spawn } from 'node:child_process';
import path from 'node:path';

function runCommand(cwd: string, command: string, args: string[], timeoutMs = 10 * 60_000): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunks: string[] = [];
		const child = spawn(command, args, {
			cwd,
			env: { ...process.env },
			shell: process.platform === 'win32'
		});
		const timer = setTimeout(() => {
			child.kill('SIGTERM');
			reject(new Error(`Timeout (${Math.round(timeoutMs / 60_000)} min)`));
		}, timeoutMs);
		child.stdout?.on('data', d => chunks.push(String(d)));
		child.stderr?.on('data', d => chunks.push(String(d)));
		child.on('close', code => {
			clearTimeout(timer);
			const output = chunks.join('');
			if (code === 0) {
				resolve(output);
			} else {
				reject(new Error(output || `Comando falhou com codigo ${code ?? '?'}`));
			}
		});
		child.on('error', reject);
	});
}

function prismaBin(projectPath: string): { command: string; prefix: string[] } {
	const local = path.join(projectPath, 'node_modules', '.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma');
	return { command: process.platform === 'win32' ? 'npx.cmd' : 'npx', prefix: ['prisma'] };
}

export async function runPrismaGenerate(projectPath: string): Promise<string> {
	const { command, prefix } = prismaBin(projectPath);
	return runCommand(projectPath, command, [...prefix, 'generate']);
}

export async function runPrismaMigrate(projectPath: string, name?: string): Promise<string> {
	const migrationName = (name?.trim() || 'api_studio').replace(/[^a-z0-9_-]/gi, '_');
	const { command, prefix } = prismaBin(projectPath);
	return runCommand(projectPath, command, [...prefix, 'migrate', 'dev', '--name', migrationName]);
}

export async function runPrismaDbPush(projectPath: string): Promise<string> {
	const { command, prefix } = prismaBin(projectPath);
	return runCommand(projectPath, command, [...prefix, 'db', 'push']);
}
