import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

dotenv.config();

function envFlag(name: string, defaultValue: boolean): boolean {
	const raw = process.env[name];
	if (raw === undefined || raw === '') {
		return defaultValue;
	}
	return raw === '1' || raw.toLowerCase() === 'true';
}

const simpleMode = envFlag('PRINCY_SIMPLE_MODE', false);

export const config = {
	appOrigin: process.env.APP_ORIGIN ?? 'http://127.0.0.1:3200',
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
	/** Limita tokens gerados (menor = resposta mais rapida no Ollama). */
	ollamaNumPredict: Number(process.env.PRINCY_OLLAMA_NUM_PREDICT ?? '2048'),
	ollamaNumCtx: Number(process.env.PRINCY_OLLAMA_NUM_CTX ?? '4096'),
	groqApiKey: process.env.GROQ_API_KEY ?? '',
	groqBaseUrl: process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1',
	groqChatModel: process.env.GROQ_CHAT_MODEL ?? 'llama-3.1-8b-instant',
	googleAiApiKey: process.env.GOOGLE_AI_API_KEY ?? '',
	deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? '',
	deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com',
	huggingfaceApiKey: process.env.HUGGINGFACE_API_KEY ?? '',
	simpleMode,
	ragEnabled: envFlag('PRINCY_RAG_ENABLED', !simpleMode),
	terminalContext: envFlag('PRINCY_TERMINAL_CONTEXT', !simpleMode),
	autoDiff: envFlag('PRINCY_AUTO_DIFF', !simpleMode),
	requireApproval: envFlag('PRINCY_REQUIRE_APPROVAL', !simpleMode),
	shadowContext: envFlag('PRINCY_SHADOW_CONTEXT', !simpleMode),
	orchestratorEnabled: simpleMode ? false : (process.env.PRINCY_ORCHESTRATOR_ENABLED ?? 'true').toLowerCase() !== 'false',
	orchestratorConsensusEnabled: simpleMode ? false : (process.env.PRINCY_ORCHESTRATOR_CONSENSUS ?? 'true').toLowerCase() !== 'false',
	orchestratorAutoHeal: simpleMode ? false : (process.env.PRINCY_ORCHESTRATOR_AUTO_HEAL ?? 'true').toLowerCase() !== 'false',
	autoCompileValidate: simpleMode ? false : (process.env.PRINCY_AUTO_COMPILE_VALIDATE ?? 'true').toLowerCase() !== 'false',
	codeWebUrl: process.env.CODE_WEB_URL ?? 'http://127.0.0.1:3200',
	editorProjectRoot: path.resolve(process.env.EDITOR_PROJECT_ROOT ?? 'C:/Apps/Editor'),
	projectRagIndexingEnabled: simpleMode ? false : (process.env.PRINCY_PROJECT_RAG_INDEXING ?? 'true').toLowerCase() !== 'false',
	projectRagMaxFiles: Number(process.env.PRINCY_PROJECT_RAG_MAX_FILES ?? '120'),
	agentTestDrivenEnabled: (process.env.PRINCY_AGENT_TDA_ENABLED ?? 'true').toLowerCase() !== 'false',
	agentAsyncJobsEnabled: simpleMode ? false : (process.env.PRINCY_AGENT_ASYNC_JOBS ?? 'true').toLowerCase() !== 'false',
	agentStreamTokens: (process.env.PRINCY_AGENT_STREAM_TOKENS ?? 'true').toLowerCase() !== 'false',
	agentApiToken: process.env.AGENT_API_TOKEN ?? '',
	/** Permite chat no dashboard (3210) sem Bearer quando AGENT_API_TOKEN estiver definido. */
	publicChatEnabled: envFlag('PRINCY_PUBLIC_CHAT', true),
	agentWorkspaceName: process.env.AGENT_WORKSPACE_NAME ?? 'Code-OSS Web',
	corsOrigins: (process.env.PRINCY_CORS_ORIGINS ?? '')
		.split(',')
		.map(value => value.trim())
		.filter(Boolean),
	corsRelaxed: (process.env.PRINCY_CORS_RELAXED ?? 'false').toLowerCase() === 'true',
	ragMaxChunks: Number(process.env.RAG_MAX_CHUNKS ?? '6'),
	ragChunkSize: Number(process.env.RAG_CHUNK_SIZE ?? '1200'),
	sessionSecret: process.env.SESSION_SECRET ?? 'dev-session-secret-change-me',
	workspaceStorageRoot: path.resolve(process.env.WORKSPACE_STORAGE_ROOT ?? './workspace-storage')
};
