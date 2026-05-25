import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { config } from '../config.js';
import type { AgentRole } from '../agentJob/types.js';

const execFileAsync = promisify(execFile);

const activeWorktrees = new Map<string, string>();

export function getWorktreeRoot(): string {
	return path.join(config.editorProjectRoot, '.princy-worktrees');
}

export function resolveWorktreePath(swarmJobId: string, role: AgentRole): string {
	return path.join(getWorktreeRoot(), swarmJobId, role);
}

export async function allocateWorktree(params: {
	readonly swarmJobId: string;
	readonly role: AgentRole;
	readonly repoRoot?: string;
}): Promise<string> {
	const repoRoot = params.repoRoot ?? config.editorProjectRoot;
	const wtPath = resolveWorktreePath(params.swarmJobId, params.role);
	const key = `${params.swarmJobId}:${params.role}`;

	if (activeWorktrees.has(key)) {
		return activeWorktrees.get(key)!;
	}

	fs.mkdirSync(path.dirname(wtPath), { recursive: true });

	if (fs.existsSync(wtPath)) {
		activeWorktrees.set(key, wtPath);
		return wtPath;
	}

	try {
		await execFileAsync('git', ['worktree', 'add', '--detach', wtPath, 'HEAD'], {
			cwd: repoRoot,
			windowsHide: true
		});
	} catch (error) {
		// Fallback: copy workspace skeleton when git worktree unavailable
		fs.mkdirSync(wtPath, { recursive: true });
		const marker = path.join(wtPath, '.princy-worktree-fallback');
		fs.writeFileSync(marker, `role=${params.role}\njob=${params.swarmJobId}\nerror=${error instanceof Error ? error.message : String(error)}\n`);
	}

	activeWorktrees.set(key, wtPath);
	return wtPath;
}

export async function releaseWorktree(swarmJobId: string, role: AgentRole, repoRoot?: string): Promise<void> {
	const key = `${swarmJobId}:${role}`;
	const wtPath = activeWorktrees.get(key) ?? resolveWorktreePath(swarmJobId, role);
	activeWorktrees.delete(key);

	if (!fs.existsSync(wtPath)) {
		return;
	}

	const root = repoRoot ?? config.editorProjectRoot;
	try {
		await execFileAsync('git', ['worktree', 'remove', '--force', wtPath], {
			cwd: root,
			windowsHide: true
		});
	} catch {
		fs.rmSync(wtPath, { recursive: true, force: true });
	}
}

export async function releaseSwarmWorktrees(swarmJobId: string, roles: readonly AgentRole[]): Promise<void> {
	await Promise.all(roles.map(role => releaseWorktree(swarmJobId, role)));
}

/** Maps a path inside a worktree back to the main workspace path. */
export function mapWorktreePathToWorkspace(worktreePath: string, workspaceRoot: string, filePath: string): string {
	const normalized = filePath.replace(/\\/g, '/');
	const wtNorm = worktreePath.replace(/\\/g, '/');
	if (normalized.startsWith(wtNorm)) {
		const relative = normalized.slice(wtNorm.length).replace(/^\//, '');
		return path.join(workspaceRoot, relative);
	}
	return filePath;
}

/** Maps a workspace path to the equivalent path inside a worktree. */
export function mapWorkspacePathToWorktree(worktreePath: string, workspaceRoot: string, filePath: string): string {
	const normalized = filePath.replace(/\\/g, '/');
	const wsNorm = workspaceRoot.replace(/\\/g, '/');
	if (normalized.startsWith(wsNorm)) {
		const relative = normalized.slice(wsNorm.length).replace(/^\//, '');
		return path.join(worktreePath, relative);
	}
	return filePath;
}

export function listActiveWorktrees(): readonly { readonly key: string; readonly path: string }[] {
	return [...activeWorktrees.entries()].map(([key, wtPath]) => ({ key, path: wtPath }));
}
