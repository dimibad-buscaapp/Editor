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
	ollamaChatModel: process.env.OLLAMA_CHAT_MODEL ?? 'deepseek-coder',
	ollamaEmbeddingModel: process.env.OLLAMA_EMBEDDING_MODEL ?? 'nomic-embed-text',
	groqApiKey: process.env.GROQ_API_KEY ?? '',
	groqBaseUrl: process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1',
	googleAiApiKey: process.env.GOOGLE_AI_API_KEY ?? '',
	deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? '',
	deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com',
	huggingfaceApiKey: process.env.HUGGINGFACE_API_KEY ?? '',
	orchestratorEnabled: (process.env.PRINCY_ORCHESTRATOR_ENABLED ?? 'true').toLowerCase() !== 'false',
	orchestratorConsensusEnabled: (process.env.PRINCY_ORCHESTRATOR_CONSENSUS ?? 'true').toLowerCase() !== 'false',
	orchestratorAutoHeal: (process.env.PRINCY_ORCHESTRATOR_AUTO_HEAL ?? 'true').toLowerCase() !== 'false',
	autoCompileValidate: (process.env.PRINCY_AUTO_COMPILE_VALIDATE ?? 'true').toLowerCase() !== 'false',
	codeWebUrl: process.env.CODE_WEB_URL ?? 'http://127.0.0.1:3200',
	editorProjectRoot: path.resolve(process.env.EDITOR_PROJECT_ROOT ?? 'C:/Apps/Editor'),
	projectRagIndexingEnabled: (process.env.PRINCY_PROJECT_RAG_INDEXING ?? 'true').toLowerCase() !== 'false',
	projectRagMaxFiles: Number(process.env.PRINCY_PROJECT_RAG_MAX_FILES ?? '120'),
	agentTestDrivenEnabled: (process.env.PRINCY_AGENT_TDA_ENABLED ?? 'true').toLowerCase() !== 'false',
	agentAsyncJobsEnabled: (process.env.PRINCY_AGENT_ASYNC_JOBS ?? 'true').toLowerCase() !== 'false',
	agentApiToken: process.env.AGENT_API_TOKEN ?? '',
	agentWorkspaceName: process.env.AGENT_WORKSPACE_NAME ?? 'Code-OSS Web',
	ragMaxChunks: Number(process.env.RAG_MAX_CHUNKS ?? '6'),
	ragChunkSize: Number(process.env.RAG_CHUNK_SIZE ?? '1200'),
	sessionSecret: process.env.SESSION_SECRET ?? 'dev-session-secret-change-me',
	workspaceStorageRoot: path.resolve(process.env.WORKSPACE_STORAGE_ROOT ?? './workspace-storage')
};
