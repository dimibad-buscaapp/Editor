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

/** Subpath publico do Code Web (migracao: antes o editor era a raiz do dominio). */
const princyVpsHost = process.env.PRINCY_VPS_HOST ?? '108.181.169.40';
const editorBasePath = normalizeEditorBasePath(process.env.PRINCY_EDITOR_BASE_PATH ?? '/webeditor');
const codeWebInternalUrl = stripTrailingSlash(
	process.env.CODE_WEB_INTERNAL_URL ?? `http://${princyVpsHost}:3200`
);

function stripTrailingSlash(value: string): string {
	return value.replace(/\/+$/, '');
}

function normalizeEditorBasePath(value: string): string {
	const trimmed = value.trim() || '/webeditor';
	return trimmed.startsWith('/') ? trimmed.replace(/\/+$/, '') : `/${trimmed.replace(/\/+$/, '')}`;
}

/** Garante /webeditor em URLs de producao que ainda apontam so para o dominio ou :3200 na raiz. */
function resolveCodeWebEditorUrl(raw: string | undefined): string {
	const fallback = `${codeWebInternalUrl}${editorBasePath}`;
	if (!raw?.trim()) {
		return fallback;
	}
	try {
		const url = new URL(stripTrailingSlash(raw.trim()));
		const isEditorHost =
			url.port === '3200'
			|| (url.hostname === 'princyai.com' || url.hostname === 'www.princyai.com')
			|| url.hostname === princyVpsHost
			|| url.hostname === '127.0.0.1'
			|| url.hostname === 'localhost';
		if (isEditorHost && !url.pathname.startsWith(editorBasePath)) {
			url.pathname = editorBasePath;
		}
		return stripTrailingSlash(url.toString());
	} catch {
		return fallback;
	}
}

export const config = {
	appOrigin: process.env.APP_ORIGIN ?? `http://${princyVpsHost}:3200`,
	princyVpsHost,
	indexPort: Number(process.env.INDEX_PORT ?? process.env.PRINCY_INDEX_PORT ?? '3220'),
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
	/** URL do editor (com /webeditor). Probes de HTML do workbench. */
	codeWebUrl: resolveCodeWebEditorUrl(process.env.CODE_WEB_URL),
	/** Origem do processo Code Web na porta 3200 (proxy /princy-api fica na raiz :3200). */
	codeWebInternalUrl,
	editorBasePath,
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
	workspaceStorageRoot: path.resolve(process.env.WORKSPACE_STORAGE_ROOT ?? './workspace-storage'),
	projectsRoot: path.resolve(process.env.PRINCY_PROJECTS_ROOT ?? 'C:/Apps/Projects'),
	compileJobWaitTimeoutMs: Number(process.env.PRINCY_COMPILE_WAIT_MS ?? String(30 * 60_000)),
	allowedWorkspaceRoots: (() => {
		const editorRoot = path.resolve(process.env.EDITOR_PROJECT_ROOT ?? 'C:/Apps/Editor');
		const projectsRoot = path.resolve(process.env.PRINCY_PROJECTS_ROOT ?? 'C:/Apps/Projects');
		const extra = (process.env.PRINCY_ALLOWED_WORKSPACE_ROOTS ?? '')
			.split(',')
			.map(value => value.trim())
			.filter(Boolean)
			.map(value => path.resolve(value));
		return [...new Set([...extra, editorRoot, projectsRoot])];
	})()
};
