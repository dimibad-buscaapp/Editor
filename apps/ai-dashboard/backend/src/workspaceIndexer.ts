import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { indexAgentFile } from './rag.js';

const indexableExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.py', '.go', '.rs', '.sql', '.prisma']);
const ignoredDirectories = new Set(['node_modules', '.git', 'out', 'dist', 'build', '.next', 'coverage', '.cache']);

export async function indexEditorProject(maxFiles = 200): Promise<number> {
	const root = config.editorProjectRoot;
	let indexed = 0;

	async function walk(currentDir: string): Promise<void> {
		if (indexed >= maxFiles) {
			return;
		}

		const entries = await fs.readdir(currentDir, { withFileTypes: true });
		for (const entry of entries) {
			if (indexed >= maxFiles) {
				return;
			}

			const fullPath = path.join(currentDir, entry.name);
			if (entry.isDirectory()) {
				if (ignoredDirectories.has(entry.name)) {
					continue;
				}
				await walk(fullPath);
				continue;
			}

			if (!entry.isFile()) {
				continue;
			}

			const extension = path.extname(entry.name).toLowerCase();
			if (!indexableExtensions.has(extension)) {
				continue;
			}

			const relativePath = path.relative(root, fullPath).replace(/\\/g, '/');
			const stat = await fs.stat(fullPath);
			if (stat.size > 250_000) {
				continue;
			}

			const content = await fs.readFile(fullPath, 'utf8');
			await indexAgentFile({
				workspaceName: config.agentWorkspaceName,
				filePath: relativePath,
				content
			});
			indexed++;
		}
	}

	await walk(root);
	return indexed;
}
