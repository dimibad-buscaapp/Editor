import type { ChatMessage } from '../ai.js';

export type ModelSegment = 'LOGIC' | 'FRONTEND' | 'BACKEND' | 'DEBUG';

export type EngineProvider = 'groq' | 'google' | 'deepseek' | 'ollama' | 'openai' | 'huggingface';

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
	readonly consensusApplied: boolean;
};

export type OrchestratorExecuteOptions = {
	readonly segment?: ModelSegment;
	readonly filePath?: string;
	readonly languageId?: string;
	readonly messages: readonly ChatMessage[];
};
