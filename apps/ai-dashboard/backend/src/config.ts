import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
	appOrigin: process.env.APP_ORIGIN ?? 'http://localhost:5173',
	apiHost: process.env.API_HOST ?? '0.0.0.0',
	apiPort: Number(process.env.API_PORT ?? '3210'),
	databaseUrl: process.env.DATABASE_URL,
	aiProvider: process.env.AI_PROVIDER ?? 'ollama',
	openAiApiKey: process.env.OPENAI_API_KEY,
	openAiChatModel: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
	openAiEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
	ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
	ollamaChatModel: process.env.OLLAMA_CHAT_MODEL ?? 'llama3.1',
	ollamaEmbeddingModel: process.env.OLLAMA_EMBEDDING_MODEL ?? 'nomic-embed-text',
	agentApiToken: process.env.AGENT_API_TOKEN ?? '',
	agentWorkspaceName: process.env.AGENT_WORKSPACE_NAME ?? 'Code-OSS Web',
	ragMaxChunks: Number(process.env.RAG_MAX_CHUNKS ?? '6'),
	ragChunkSize: Number(process.env.RAG_CHUNK_SIZE ?? '1200'),
	sessionSecret: process.env.SESSION_SECRET ?? 'dev-session-secret-change-me',
	workspaceStorageRoot: path.resolve(process.env.WORKSPACE_STORAGE_ROOT ?? './workspace-storage')
};
