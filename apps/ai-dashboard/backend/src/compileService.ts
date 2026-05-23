import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import type { VpsCompileStatus } from './orchestrator/types.js';

export type CompileValidationResult = {
	readonly status: VpsCompileStatus;
	readonly codeWebReachable: boolean;
	readonly serverMainReady: boolean;
	readonly output?: string;
	readonly jobId?: string;
};

type CompileJob = {
	readonly id: string;
	readonly status: VpsCompileStatus;
	readonly output: string;
	readonly startedAt: number;
};

const compileJobs = new Map<string, CompileJob>();

export async function validateVpsEnvironment(options?: {
	readonly priority?: 'normal' | 'high';
	readonly triggerCompile?: boolean;
}): Promise<CompileValidationResult> {
	const codeWebReachable = await isCodeWebReachable();
	const serverMainReady = fs.existsSync(path.join(config.editorProjectRoot, 'out', 'server-main.js'));

	if (!config.autoCompileValidate || (!options?.triggerCompile && options?.priority !== 'high')) {
		return {
			status: serverMainReady && codeWebReachable ? 'READY' : serverMainReady ? 'PENDING' : 'FAILED',
			codeWebReachable,
			serverMainReady
		};
	}

	const jobId = startCompileWebJob();
	return {
		status: 'COMPILING',
		codeWebReachable,
		serverMainReady,
		jobId
	};
}

export function getCompileJobStatus(jobId: string): CompileValidationResult | undefined {
	const job = compileJobs.get(jobId);
	if (!job) {
		return undefined;
	}

	return {
		status: job.status,
		codeWebReachable: false,
		serverMainReady: fs.existsSync(path.join(config.editorProjectRoot, 'out', 'server-main.js')),
		output: job.output,
		jobId
	};
}

async function isCodeWebReachable(): Promise<boolean> {
	try {
		const response = await fetch(config.codeWebUrl, {
			signal: AbortSignal.timeout(4000)
		});
		return response.status < 500;
	} catch {
		return false;
	}
}

function startCompileWebJob(): string {
	const jobId = `compile-${Date.now()}`;
	compileJobs.set(jobId, {
		id: jobId,
		status: 'COMPILING',
		output: '',
		startedAt: Date.now()
	});

	const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
	const child = spawn(npm, ['run', 'compile-web'], {
		cwd: config.editorProjectRoot,
		env: {
			...process.env,
			NODE_OPTIONS: '--max-old-space-size=8192'
		},
		shell: process.platform === 'win32'
	});

	let output = '';
	child.stdout?.on('data', chunk => {
		output += String(chunk);
		updateJobOutput(jobId, output);
	});
	child.stderr?.on('data', chunk => {
		output += String(chunk);
		updateJobOutput(jobId, output);
	});
	child.on('close', code => {
		const job = compileJobs.get(jobId);
		if (!job) {
			return;
		}
		compileJobs.set(jobId, {
			...job,
			status: code === 0 ? 'READY' : 'FAILED',
			output: output.slice(-8000)
		});
	});
	child.on('error', error => {
		const job = compileJobs.get(jobId);
		if (!job) {
			return;
		}
		compileJobs.set(jobId, {
			...job,
			status: 'FAILED',
			output: `${job.output}\n${error instanceof Error ? error.message : String(error)}`.slice(-8000)
		});
	});

	return jobId;
}

function updateJobOutput(jobId: string, output: string): void {
	const job = compileJobs.get(jobId);
	if (!job) {
		return;
	}
	compileJobs.set(jobId, {
		...job,
		output: output.slice(-8000)
	});
}

export async function waitForCompileJob(
	jobId: string,
	timeoutMs: number,
	pollIntervalMs = 2000
): Promise<CompileValidationResult> {
	const startedAt = Date.now();
	while (Date.now() - startedAt < timeoutMs) {
		const status = getCompileJobStatus(jobId);
		if (!status) {
			throw new Error(`Compile job not found: ${jobId}`);
		}
		if (status.status === 'READY' || status.status === 'FAILED') {
			return status;
		}
		await new Promise<void>(resolve => setTimeout(resolve, pollIntervalMs));
	}
	const last = getCompileJobStatus(jobId);
	return last ?? {
		status: 'FAILED',
		codeWebReachable: false,
		serverMainReady: false,
		output: 'Timeout aguardando compilacao',
		jobId
	};
}
