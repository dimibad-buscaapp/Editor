import type { ChatMessage } from '../ai.js';
import { config } from '../config.js';
import type { EngineProvider, EngineSpec, ModelResponse } from './types.js';

type OpenAiStyleResponse = {
	choices?: Array<{
		message?: {
			content?: string;
		};
	}>;
};

type GeminiResponse = {
	candidates?: Array<{
		content?: {
			parts?: Array<{
				text?: string;
			}>;
		};
	}>;
};

type OllamaChatResponse = {
	message?: {
		content?: string;
	};
	response?: string;
};

export function isProviderConfigured(provider: EngineProvider): boolean {
	switch (provider) {
		case 'groq':
			return Boolean(config.groqApiKey);
		case 'google':
			return Boolean(config.googleAiApiKey);
		case 'deepseek':
			return Boolean(config.deepseekApiKey);
		case 'openai':
			return Boolean(config.openAiApiKey);
		case 'huggingface':
			return Boolean(config.huggingfaceApiKey);
		case 'ollama':
			return true;
	}
}

export async function callEngine(engine: EngineSpec, messages: readonly ChatMessage[]): Promise<ModelResponse> {
	const errors: string[] = [];

	if (isProviderConfigured(engine.provider)) {
		try {
			return await callProvider(engine.provider, engine.model, engine.id, messages);
		} catch (error) {
			errors.push(`${engine.provider}: ${formatError(error)}`);
		}
	}

	if (engine.ollamaFallback) {
		try {
			return await callProvider('ollama', engine.ollamaFallback, `${engine.id}-ollama-fallback`, messages);
		} catch (error) {
			errors.push(`ollama(${engine.ollamaFallback}): ${formatError(error)}`);
		}
	}

	throw new Error(`Nenhum motor disponivel para ${engine.label}. ${errors.join(' | ')}`);
}

async function callProvider(provider: EngineProvider, model: string, modelName: string, messages: readonly ChatMessage[]): Promise<ModelResponse> {
	switch (provider) {
		case 'groq':
			return callOpenAiCompatible(config.groqBaseUrl, config.groqApiKey!, model, modelName, 'groq', messages);
		case 'deepseek':
			return callOpenAiCompatible(config.deepseekBaseUrl, config.deepseekApiKey!, model, modelName, 'deepseek', messages);
		case 'openai':
			return callOpenAiCompatible('https://api.openai.com/v1', config.openAiApiKey!, model, modelName, 'openai', messages);
		case 'google':
			return callGemini(model, modelName, messages);
		case 'ollama':
			return callOllama(model, modelName, messages);
		case 'huggingface':
			return callHuggingFace(model, modelName, messages);
	}
}

async function callOpenAiCompatible(
	baseUrl: string,
	apiKey: string,
	model: string,
	modelName: string,
	provider: EngineProvider,
	messages: readonly ChatMessage[]
): Promise<ModelResponse> {
	const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model,
			messages,
			temperature: 0.2
		})
	});

	if (!response.ok) {
		throw new Error(await response.text());
	}

	const payload = await response.json() as OpenAiStyleResponse;
	const content = payload.choices?.[0]?.message?.content?.trim();
	if (!content) {
		throw new Error('Resposta vazia do provedor');
	}

	return {
		content,
		confidence: 0.9,
		modelName,
		provider
	};
}

async function callGemini(model: string, modelName: string, messages: readonly ChatMessage[]): Promise<ModelResponse> {
	if (!config.googleAiApiKey) {
		throw new Error('GOOGLE_AI_API_KEY ausente');
	}

	const systemParts = messages.filter(message => message.role === 'system').map(message => message.content);
	const conversation = messages
		.filter(message => message.role !== 'system')
		.map(message => ({
			role: message.role === 'assistant' ? 'model' : 'user',
			parts: [{ text: message.content }]
		}));

	const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.googleAiApiKey}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			systemInstruction: systemParts.length ? { parts: [{ text: systemParts.join('\n\n') }] } : undefined,
			contents: conversation,
			generationConfig: {
				temperature: 0.2
			}
		})
	});

	if (!response.ok) {
		throw new Error(await response.text());
	}

	const payload = await response.json() as GeminiResponse;
	const content = payload.candidates?.[0]?.content?.parts?.map(part => part.text ?? '').join('').trim();
	if (!content) {
		throw new Error('Gemini retornou resposta vazia');
	}

	return {
		content,
		confidence: 0.9,
		modelName,
		provider: 'google'
	};
}

async function callOllama(model: string, modelName: string, messages: readonly ChatMessage[]): Promise<ModelResponse> {
	const response = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model,
			messages,
			stream: false,
			options: {
				temperature: 0.2
			}
		})
	});

	if (!response.ok) {
		throw new Error(await response.text());
	}

	const payload = await response.json() as OllamaChatResponse;
	const content = payload.message?.content ?? payload.response;
	if (!content?.trim()) {
		throw new Error('Ollama retornou resposta vazia');
	}

	return {
		content: content.trim(),
		confidence: 0.85,
		modelName,
		provider: 'ollama'
	};
}

async function callHuggingFace(model: string, modelName: string, messages: readonly ChatMessage[]): Promise<ModelResponse> {
	if (!config.huggingfaceApiKey) {
		throw new Error('HUGGINGFACE_API_KEY ausente');
	}

	const prompt = messages
		.map(message => `${message.role.toUpperCase()}: ${message.content}`)
		.join('\n\n');

	const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${config.huggingfaceApiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			inputs: prompt,
			parameters: {
				max_new_tokens: 2048,
				return_full_text: false
			}
		})
	});

	if (!response.ok) {
		throw new Error(await response.text());
	}

	const payload = await response.json() as Array<{ generated_text?: string }> | { generated_text?: string };
	const content = Array.isArray(payload) ? payload[0]?.generated_text : payload.generated_text;
	if (!content?.trim()) {
		throw new Error('Hugging Face retornou resposta vazia');
	}

	return {
		content: content.trim(),
		confidence: 0.8,
		modelName,
		provider: 'huggingface'
	};
}

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
