import { config } from './config.js';

export type ChatMessage = {
	role: 'system' | 'user' | 'assistant';
	content: string;
};

type OpenAiEmbeddingResponse = {
	data: Array<{
		embedding: number[];
	}>;
};

type OpenAiChatResponse = {
	choices: Array<{
		message?: {
			content?: string;
		};
	}>;
};

type OllamaEmbedResponse = {
	embedding?: number[];
	embeddings?: number[][];
};

type OllamaChatResponse = {
	message?: {
		content?: string;
	};
	response?: string;
};

export async function createEmbedding(input: string): Promise<number[]> {
	if (config.aiProvider === 'openai') {
		return createOpenAiEmbedding(input);
	}

	return createOllamaEmbedding(input);
}

export async function createChatCompletion(messages: ChatMessage[]): Promise<string> {
	if (config.aiProvider === 'openai') {
		return createOpenAiChatCompletion(messages);
	}

	return createOllamaChatCompletion(messages);
}

async function createOpenAiEmbedding(input: string): Promise<number[]> {
	if (!config.openAiApiKey) {
		throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai');
	}

	const response = await fetch('https://api.openai.com/v1/embeddings', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${config.openAiApiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: config.openAiEmbeddingModel,
			input
		})
	});

	if (!response.ok) {
		throw new Error(`OpenAI embeddings failed: ${await response.text()}`);
	}

	const payload = await response.json() as OpenAiEmbeddingResponse;
	const embedding = payload.data[0]?.embedding;
	if (!embedding) {
		throw new Error('OpenAI did not return an embedding');
	}

	return embedding;
}

async function createOpenAiChatCompletion(messages: ChatMessage[]): Promise<string> {
	if (!config.openAiApiKey) {
		throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai');
	}

	const response = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${config.openAiApiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: config.openAiChatModel,
			messages,
			temperature: 0.2
		})
	});

	if (!response.ok) {
		throw new Error(`OpenAI chat failed: ${await response.text()}`);
	}

	const payload = await response.json() as OpenAiChatResponse;
	return payload.choices[0]?.message?.content ?? 'A LLM nao retornou conteudo.';
}

async function createOllamaEmbedding(input: string): Promise<number[]> {
	const response = await fetch(`${config.ollamaBaseUrl}/api/embed`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: config.ollamaEmbeddingModel,
			input
		})
	});

	if (!response.ok) {
		throw new Error(`Ollama embeddings failed: ${await response.text()}`);
	}

	const payload = await response.json() as OllamaEmbedResponse;
	const embedding = payload.embeddings?.[0] ?? payload.embedding;
	if (!embedding) {
		throw new Error('Ollama did not return an embedding');
	}

	return embedding;
}

async function createOllamaChatCompletion(messages: ChatMessage[]): Promise<string> {
	const response = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: config.ollamaChatModel,
			messages,
			stream: false,
			options: {
				temperature: 0.2
			}
		})
	});

	if (!response.ok) {
		throw new Error(`Ollama chat failed: ${await response.text()}`);
	}

	const payload = await response.json() as OllamaChatResponse;
	return payload.message?.content ?? payload.response ?? 'A LLM local nao retornou conteudo.';
}
