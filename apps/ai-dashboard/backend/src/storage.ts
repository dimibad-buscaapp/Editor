import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

export type WorkspaceFileEntry = {
	path: string;
	size: number;
	updatedAt: string;
};

export function normalizeWorkspacePath(input: string): string {
	const value = input.replace(/\\/g, '/').trim();

	if (!value || value.includes('\0') || value.startsWith('/') || path.win32.isAbsolute(input)) {
		throw new Error('Invalid file path');
	}

	const normalized = path.posix.normalize(value);
	if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
		throw new Error('Invalid file path');
	}

	return normalized;
}

export async function createWorkspaceRoot(userId: string, workspaceId: string, workspaceName: string): Promise<string> {
	const rootPath = path.join(config.workspaceStorageRoot, userId, workspaceId);
	await fs.mkdir(rootPath, { recursive: true });

	const readmePath = path.join(rootPath, 'README.md');
	try {
		await fs.access(readmePath);
	} catch {
		await fs.writeFile(readmePath, `# ${workspaceName}\n\nWorkspace criado pelo AI Dashboard.\n`, 'utf8');
	}

	return rootPath;
}

export async function listWorkspaceFiles(rootPath: string): Promise<WorkspaceFileEntry[]> {
	const files: WorkspaceFileEntry[] = [];

	async function walk(currentPath: string): Promise<void> {
		const entries = await fs.readdir(currentPath, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(currentPath, entry.name);
			if (entry.isDirectory()) {
				await walk(fullPath);
				continue;
			}

			if (!entry.isFile()) {
				continue;
			}

			const stat = await fs.stat(fullPath);
			files.push({
				path: path.relative(rootPath, fullPath).replace(/\\/g, '/'),
				size: stat.size,
				updatedAt: stat.mtime.toISOString()
			});
		}
	}

	await fs.mkdir(rootPath, { recursive: true });
	await walk(rootPath);
	return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function readWorkspaceFile(rootPath: string, filePath: string): Promise<string> {
	const resolvedPath = resolveWorkspaceFilePath(rootPath, filePath);
	return fs.readFile(resolvedPath, 'utf8');
}

export async function writeWorkspaceFile(rootPath: string, filePath: string, content: string): Promise<{ contentHash: string; size: number }> {
	const resolvedPath = resolveWorkspaceFilePath(rootPath, filePath);
	await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
	await fs.writeFile(resolvedPath, content, 'utf8');

	return {
		contentHash: createHash('sha256').update(content).digest('hex'),
		size: Buffer.byteLength(content, 'utf8')
	};
}

export function resolveWorkspaceFilePath(rootPath: string, filePath: string): string {
	const normalizedPath = normalizeWorkspacePath(filePath);
	const resolvedRoot = path.resolve(rootPath);
	const resolvedPath = path.resolve(resolvedRoot, normalizedPath);
	const relativePath = path.relative(resolvedRoot, resolvedPath);

	if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
		throw new Error('Invalid file path');
	}

	return resolvedPath;
}
