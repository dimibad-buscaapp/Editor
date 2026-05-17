import { createHash } from 'node:crypto';
import { createEmbedding } from './ai.js';
import { config } from './config.js';
import { prisma } from './prisma.js';
import { normalizeWorkspacePath, readWorkspaceFile } from './storage.js';

export type IndexedFile = {
	path: string;
	chunkCount: number;
};

export type FileIndexInput = {
	path: string;
	chunks?: string[];
};

export type RetrievedChunk = {
	filePath: string;
	chunkIndex: number;
	content: string;
	distance: number;
};

export async function indexWorkspaceFiles(workspace: { id: string; rootPath: string }, files: FileIndexInput[]): Promise<IndexedFile[]> {
	const indexedFiles: IndexedFile[] = [];

	for (const file of files) {
		const normalizedPath = normalizeWorkspacePath(file.path);
		const chunks = file.chunks && file.chunks.length > 0
			? file.chunks
			: chunkContent(await readWorkspaceFile(workspace.rootPath, normalizedPath), config.ragChunkSize);
		const content = chunks.join('\n');
		const contentHash = createHash('sha256').update(content).digest('hex');
		const embeddings: number[][] = [];

		for (const chunk of chunks) {
			embeddings.push(await createEmbedding(buildEmbeddingInput(normalizedPath, chunk)));
		}

		await prisma.$transaction(async tx => {
			await tx.fileChunk.deleteMany({
				where: {
					workspaceId: workspace.id,
					filePath: normalizedPath
				}
			});

			for (let index = 0; index < chunks.length; index++) {
				await tx.fileChunk.create({
					data: {
						workspaceId: workspace.id,
						filePath: normalizedPath,
						chunkIndex: index,
						content: chunks[index],
						contentHash,
						embedding: embeddings[index]
					}
				});
			}

			await tx.fileEmbeddingJob.create({
				data: {
					workspaceId: workspace.id,
					filePath: normalizedPath,
					chunkCount: chunks.length,
					status: 'completed'
				}
			});
		}, {
			timeout: 120000
		});

		indexedFiles.push({
			path: normalizedPath,
			chunkCount: chunks.length
		});
	}

	return indexedFiles;
}

export async function retrieveRelevantChunks(workspaceId: string, query: string): Promise<RetrievedChunk[]> {
	const embedding = await createEmbedding(query);
	const chunks = await prisma.fileChunk.findMany({
		where: {
			workspaceId
		},
		select: {
			filePath: true,
			chunkIndex: true,
			content: true,
			embedding: true
		}
	});

	return chunks
		.map(chunk => ({
			filePath: chunk.filePath,
			chunkIndex: chunk.chunkIndex,
			content: chunk.content,
			distance: cosineDistance(embedding, parseEmbedding(chunk.embedding))
		}))
		.sort((a, b) => a.distance - b.distance)
		.slice(0, config.ragMaxChunks);
}

export function buildRagSystemPrompt(chunks: RetrievedChunk[]): string {
	const context = chunks.length > 0
		? chunks.map(chunk => [
			`Arquivo: ${chunk.filePath}`,
			`Chunk: ${chunk.chunkIndex}`,
			'Conteudo:',
			chunk.content
		].join('\n')).join('\n\n---\n\n')
		: 'Nenhum chunk indexado foi encontrado para este workspace.';

	return [
		'Voce e um assistente de programacao dentro de um editor web.',
		'Responda em portugues, seja direto e use o contexto do workspace quando ele for relevante.',
		'Se o contexto nao tiver informacao suficiente, diga isso claramente e sugira o proximo passo.',
		'Contexto recuperado por busca semantica:',
		context
	].join('\n\n');
}

function chunkContent(content: string, chunkSize: number): string[] {
	const normalized = content.trim();
	if (!normalized) {
		return [''];
	}

	const chunks: string[] = [];
	for (let offset = 0; offset < normalized.length; offset += chunkSize) {
		chunks.push(normalized.slice(offset, offset + chunkSize));
	}

	return chunks;
}

function buildEmbeddingInput(filePath: string, content: string): string {
	return `Arquivo: ${filePath}\n\n${content}`;
}

function parseEmbedding(value: unknown): number[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.map(item => typeof item === 'number' && Number.isFinite(item) ? item : 0);
}

function cosineDistance(left: number[], right: number[]): number {
	if (left.length === 0 || left.length !== right.length) {
		return Number.POSITIVE_INFINITY;
	}

	let dot = 0;
	let leftMagnitude = 0;
	let rightMagnitude = 0;

	for (let index = 0; index < left.length; index++) {
		dot += left[index] * right[index];
		leftMagnitude += left[index] * left[index];
		rightMagnitude += right[index] * right[index];
	}

	if (leftMagnitude === 0 || rightMagnitude === 0) {
		return Number.POSITIVE_INFINITY;
	}

	return 1 - dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}
