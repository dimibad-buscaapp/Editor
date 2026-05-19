import type { ChatMessage } from '../ai.js';

export type ModelSegment = 'LOGIC' | 'FRONTEND' | 'BACKEND' | 'DEBUG';

export type EngineProvider = 'groq' | 'google' | 'deepseek' | 'ollama' | 'openai' | 'huggingface';

export type OrchestratorStatus = 'COMPLETED' | 'FAILED' | 'FALLBACK';

export type VpsCompileStatus = 'PENDING' | 'COMPILING' | 'READY' | 'FAILED' | 'SKIPPED';

export type EngineSpec = {
	readonly id: string;
	readonly label: string;
	readonly provider: EngineProvider;
	readonly model: string;
	readonly ollamaFallback?: string;
};

export type ModelResponse = {
	readonly content: string;
	readonly confidence: number;
	readonly modelName: string;
	readonly provider: EngineProvider;
};

export type OrchestratorResult = {
	readonly content: string;
	readonly segment: ModelSegment;
	readonly enginesUsed: readonly string[];
	readonly primaryEngine: string;
	readonly fallbackEngines: readonly string[];
	readonly consensusApplied: boolean;
	readonly status: OrchestratorStatus;
	readonly executionTimeMs: number;
};

export type OrchestratorExecuteOptions = {
	readonly segment?: ModelSegment;
	readonly filePath?: string;
	readonly languageId?: string;
	readonly messages: readonly ChatMessage[];
};
