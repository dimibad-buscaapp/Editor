import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from './generated/prisma/client.js';
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
			await tx.$executeRaw`
				DELETE FROM "FileChunk"
				WHERE "workspaceId" = ${workspace.id}
					AND "filePath" = ${normalizedPath}
			`;

			for (let index = 0; index < chunks.length; index++) {
				await tx.$executeRaw`
					INSERT INTO "FileChunk" ("id", "workspaceId", "filePath", "chunkIndex", "content", "contentHash", "embedding", "createdAt", "updatedAt")
					VALUES (${randomUUID()}, ${workspace.id}, ${normalizedPath}, ${index}, ${chunks[index]}, ${contentHash}, ${vectorLiteral(embeddings[index])}::vector, NOW(), NOW())
				`;
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
	const rows = await prisma.$queryRaw<RetrievedChunk[]>`
		SELECT
			"filePath",
			"chunkIndex",
			"content",
			"embedding" <=> ${vectorLiteral(embedding)}::vector AS "distance"
		FROM "FileChunk"
		WHERE "workspaceId" = ${workspaceId}
		ORDER BY "embedding" <=> ${vectorLiteral(embedding)}::vector
		LIMIT ${config.ragMaxChunks}
	`;

	return rows;
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

function vectorLiteral(embedding: number[]): Prisma.Sql {
	return Prisma.raw(`'[${embedding.map(value => Number.isFinite(value) ? value : 0).join(',')}]'`);
}
