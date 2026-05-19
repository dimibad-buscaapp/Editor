import type { EngineSpec, ModelSegment } from './types.js';

export const segmentLabels: Record<ModelSegment, string> = {
	LOGIC: 'Arquitetura e logica',
	FRONTEND: 'Frontend e UI',
	BACKEND: 'Backend e APIs',
	DEBUG: 'Debug e auditoria'
};

export const segmentEngines: Record<ModelSegment, readonly [EngineSpec, EngineSpec, EngineSpec]> = {
	LOGIC: [
		{ id: 'deepseek-v3', label: 'DeepSeek V3', provider: 'deepseek', model: 'deepseek-chat', ollamaFallback: 'deepseek-coder' },
		{ id: 'llama-3-70b', label: 'Llama 3.3 70B', provider: 'groq', model: 'llama-3.3-70b-versatile', ollamaFallback: 'llama3.1' },
		{ id: 'mistral-large', label: 'Mistral Large', provider: 'groq', model: 'mistral-large-latest', ollamaFallback: 'mistral' }
	],
	FRONTEND: [
		{ id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', provider: 'google', model: 'gemini-1.5-flash', ollamaFallback: 'qwen2.5-coder' },
		{ id: 'llama-3-8b', label: 'Llama 3.1 8B', provider: 'groq', model: 'llama-3.1-8b-instant', ollamaFallback: 'llama3.1' },
		{ id: 'qwen-2.5-coder', label: 'Qwen 2.5 Coder', provider: 'ollama', model: 'qwen2.5-coder' }
	],
	BACKEND: [
		{ id: 'deepseek-coder', label: 'DeepSeek Coder', provider: 'deepseek', model: 'deepseek-coder', ollamaFallback: 'deepseek-coder' },
		{ id: 'qwen-2.5-coder', label: 'Qwen 2.5 Coder', provider: 'ollama', model: 'qwen2.5-coder' },
		{ id: 'phi-3', label: 'Phi-3 Medium', provider: 'ollama', model: 'phi3:medium', ollamaFallback: 'phi3' }
	],
	DEBUG: [
		{ id: 'llama-3-70b', label: 'Llama 3.3 70B', provider: 'groq', model: 'llama-3.3-70b-versatile', ollamaFallback: 'llama3.1' },
		{ id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', provider: 'google', model: 'gemini-1.5-flash', ollamaFallback: 'mistral' },
		{ id: 'mistral-7b', label: 'Mistral 7B', provider: 'groq', model: 'mistral-7b-instruct', ollamaFallback: 'mistral' }
	]
};

export function listSegmentEngines(): Array<{ segment: ModelSegment; label: string; engines: readonly EngineSpec[] }> {
	return (Object.keys(segmentEngines) as ModelSegment[]).map(segment => ({
		segment,
		label: segmentLabels[segment],
		engines: segmentEngines[segment]
	}));
}
