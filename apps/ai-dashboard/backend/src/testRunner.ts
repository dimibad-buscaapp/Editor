import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

export type TestRunResult = {
	readonly ran: boolean;
	readonly success: boolean;
	readonly output: string;
};

export async function runProjectTests(): Promise<TestRunResult> {
	const projectRoot = config.editorProjectRoot;
	const packageJsonPath = path.join(projectRoot, 'package.json');

	if (!fs.existsSync(packageJsonPath)) {
		return {
			ran: false,
			success: true,
			output: 'package.json nao encontrado; testes ignorados.'
		};
	}

	const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { scripts?: Record<string, string> };
	if (!packageJson.scripts?.test) {
		return {
			ran: false,
			success: true,
			output: 'Script npm test nao definido; testes ignorados.'
		};
	}

	return new Promise<TestRunResult>(resolve => {
		const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
		const child = spawn(npm, ['test', '--', '--runInBand', '--passWithNoTests'], {
			cwd: projectRoot,
			env: {
				...process.env,
				NODE_OPTIONS: '--max-old-space-size=4096',
				CI: 'true'
			},
			shell: process.platform === 'win32'
		});

		let output = '';
		child.stdout?.on('data', chunk => {
			output += String(chunk);
		});
		child.stderr?.on('data', chunk => {
			output += String(chunk);
		});
		child.on('close', code => {
			resolve({
				ran: true,
				success: code === 0,
				output: output.slice(-12_000)
			});
		});
		child.on('error', error => {
			resolve({
				ran: true,
				success: false,
				output: error instanceof Error ? error.message : String(error)
			});
		});
	});
}
