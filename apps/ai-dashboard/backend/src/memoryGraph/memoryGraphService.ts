import { prisma } from '../prisma.js';

export type MemoryNodeKind = 'decision' | 'file' | 'intent';

export type MemoryNodeInput = {
	readonly workspaceId: string;
	readonly kind: MemoryNodeKind;
	readonly title: string;
	readonly content: string;
	readonly filePath?: string;
	readonly metadata?: Record<string, unknown>;
};

const DEFAULT_WORKSPACE = 'default';

export function resolveWorkspaceId(request?: { readonly workspaceId?: string; readonly context?: string }): string {
	return request?.workspaceId?.trim() || DEFAULT_WORKSPACE;
}

export async function recordMemoryNode(input: MemoryNodeInput): Promise<void> {
	try {
		await prisma.memoryNode.create({
			data: {
				workspaceId: input.workspaceId,
				kind: input.kind,
				title: input.title,
				content: input.content,
				filePath: input.filePath,
				metadata: input.metadata as object | undefined
			}
		});
	} catch {
		// Memory graph is best-effort; do not block agent pipeline.
	}
}

export async function recordJobMemory(params: {
	readonly workspaceId: string;
	readonly intent: string;
	readonly decisions: readonly string[];
	readonly files: readonly string[];
	readonly metadata?: Record<string, unknown>;
}): Promise<void> {
	await recordMemoryNode({
		workspaceId: params.workspaceId,
		kind: 'intent',
		title: 'Intencao do prompt',
		content: params.intent.slice(0, 4000),
		metadata: params.metadata
	});

	for (const decision of params.decisions.slice(0, 12)) {
		await recordMemoryNode({
			workspaceId: params.workspaceId,
			kind: 'decision',
			title: decision.slice(0, 120),
			content: decision
		});
	}

	for (const filePath of params.files.slice(0, 40)) {
		await recordMemoryNode({
			workspaceId: params.workspaceId,
			kind: 'file',
			title: filePath,
			content: `Ficheiro tocado: ${filePath}`,
			filePath
		});
	}
}

export async function getMemoryContextForWorkspace(workspaceId: string, limit = 20): Promise<string> {
	try {
		const nodes = await prisma.memoryNode.findMany({
			where: { workspaceId },
			orderBy: { updatedAt: 'desc' },
			take: limit
		});
		if (nodes.length === 0) {
			return '';
		}
		const blocks = nodes.map(node => {
			const prefix = node.kind === 'decision' ? 'Decisao' : node.kind === 'file' ? 'Ficheiro' : 'Intencao';
			return `- [${prefix}] ${node.title}: ${node.content.slice(0, 400)}`;
		});
		return `\n\n## Memoria do projeto (Princy Memory Graph)\n${blocks.join('\n')}`;
	} catch {
		return '';
	}
}
