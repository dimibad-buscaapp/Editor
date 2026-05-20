import { config } from './config.js';
import { getPrincyOrchestrator } from './orchestrator/orchestrator.js';
import type { ModelSegment } from './orchestrator/types.js';

export type ChatMessage = {
	role: 'system' | 'user' | 'assistant';
	content: string;
};

export type AgentModel = 'princy' | 'deepseek' | 'qwen' | 'codellama' | 'llama3' | 'mistral' | 'openai';

export type AgentConfig = {
	id: AgentModel;
	label: string;
	modelName: string;
	isLocal: boolean;
	systemPrompt: string;
};

export const agentConfigs: Record<AgentModel, AgentConfig> = {
	princy: {
		id: 'princy',
		label: 'Princy Ai Consenso',
		modelName: config.ollamaChatModel,
		isLocal: true,
		systemPrompt: 'Voce e o Princy Ai, orquestrador de motores com consenso e fallback. Priorize respostas aplicaveis, codigo limpo, arquitetura simples e passos executaveis conforme o segmento da tarefa.'
	},
	deepseek: {
		id: 'deepseek',
		label: 'DeepSeek Coder',
		modelName: 'deepseek-coder',
		isLocal: true,
		systemPrompt: 'Voce e um especialista em algoritmos e codificacao eficiente. Priorize solucoes objetivas, performance e codigo direto.'
	},
	qwen: {
		id: 'qwen',
		label: 'Qwen Coder',
		modelName: 'qwen2.5-coder',
		isLocal: true,
		systemPrompt: 'Voce e um especialista em raciocinio de codigo, contexto longo, seguranca e analise cuidadosa de bugs.'
	},
	codellama: {
		id: 'codellama',
		label: 'CodeLlama',
		modelName: 'codellama',
		isLocal: true,
		systemPrompt: 'Voce e um agente focado em programacao pratica. Gere codigo simples, compatibilidade ampla e explicacoes curtas.'
	},
	llama3: {
		id: 'llama3',
		label: 'Llama 3.1',
		modelName: 'llama3.1',
		isLocal: true,
		systemPrompt: 'Voce e um assistente geral de engenharia de software. Ajude com planejamento, explicacao e implementacao.'
	},
	mistral: {
		id: 'mistral',
		label: 'Mistral',
		modelName: 'mistral',
		isLocal: true,
		systemPrompt: 'Voce e um agente rapido e conciso para tarefas simples, revisoes curtas e respostas objetivas.'
	},
	openai: {
		id: 'openai',
		label: 'OpenAI',
		modelName: config.openAiChatModel,
		isLocal: false,
		systemPrompt: 'Voce e um assistente avancado de programacao. Use o contexto fornecido e responda com precisao.'
	}
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

export type ChatCompletionOptions = {
	readonly segment?: ModelSegment;
	readonly filePath?: string;
	readonly languageId?: string;
	readonly useOrchestrator?: boolean;
	readonly maxTokens?: number;
	readonly temperature?: number;
	readonly stream?: boolean;
	readonly onToken?: (chunk: string, fullText: string) => void;
};

export type ChatCompletionResult = {
	readonly content: string;
	readonly orchestrator?: {
		readonly segment: ModelSegment;
		readonly enginesUsed: readonly string[];
		readonly primaryEngine: string;
		readonly fallbackEngines: readonly string[];
		readonly consensusApplied: boolean;
		readonly status: 'COMPLETED' | 'FAILED' | 'FALLBACK';
		readonly executionTimeMs: number;
	};
};

export async function createChatCompletion(messages: ChatMessage[], agent: AgentModel = 'princy', options?: ChatCompletionOptions): Promise<string> {
	const result = await createChatCompletionDetailed(messages, agent, options);
	return result.content;
}

export async function createChatCompletionDetailed(messages: ChatMessage[], agent: AgentModel = 'princy', options?: ChatCompletionOptions): Promise<ChatCompletionResult> {
	const agentConfig = agentConfigs[agent] ?? agentConfigs.princy;
	const preparedMessages = withAgentSystemPrompt(messages, agentConfig.systemPrompt);
	const useOrchestrator = !options?.stream && (options?.useOrchestrator ?? (config.orchestratorEnabled && (agent === 'princy' || agent === 'deepseek')));

	if (useOrchestrator) {
		try {
			const orchestrated = await getPrincyOrchestrator().execute({
				messages: preparedMessages,
				segment: options?.segment,
				filePath: options?.filePath,
				languageId: options?.languageId
			});

			return {
				content: orchestrated.content,
				orchestrator: {
					segment: orchestrated.segment,
					enginesUsed: orchestrated.enginesUsed,
					primaryEngine: orchestrated.primaryEngine,
					fallbackEngines: orchestrated.fallbackEngines,
					consensusApplied: orchestrated.consensusApplied,
					status: orchestrated.status,
					executionTimeMs: orchestrated.executionTimeMs
				}
			};
		} catch (orchestratorError) {
			console.warn('[princy-ai] Orquestrador falhou, usando Ollama direto:', orchestratorError instanceof Error ? orchestratorError.message : orchestratorError);
			return {
				content: await createOllamaChatCompletion(preparedMessages, config.ollamaChatModel, options)
			};
		}
	}

	if (!agentConfig.isLocal || config.aiProvider === 'openai') {
		return {
			content: await createOpenAiChatCompletion(preparedMessages, agentConfig.modelName, options)
		};
	}

	return {
		content: await createOllamaChatCompletion(preparedMessages, agentConfig.modelName, options)
	};
}

async function createOllamaChatCompletionStream(
	messages: ChatMessage[],
	modelName: string,
	options: ChatCompletionOptions | undefined,
	onToken: (chunk: string, fullText: string) => void
): Promise<string> {
	const response = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: modelName,
			messages,
			stream: true,
			options: {
				temperature: options?.temperature ?? 0.2,
				...(options?.maxTokens !== undefined ? { num_predict: options.maxTokens } : {})
			}
		})
	});

	if (!response.ok) {
		throw new Error(`Ollama chat stream failed: ${await response.text()}`);
	}

	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error('Ollama stream body unavailable');
	}

	const decoder = new TextDecoder();
	let buffer = '';
	let full = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() ?? '';

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) {
				continue;
			}
			try {
				const payload = JSON.parse(trimmed) as OllamaChatResponse;
				const piece = payload.message?.content ?? payload.response ?? '';
				if (piece) {
					full += piece;
					onToken(piece, full);
				}
			} catch {
				// ignore malformed chunks
			}
		}
	}

	return full || 'A LLM local nao retornou conteudo.';
}

async function createOpenAiChatCompletionStream(
	messages: ChatMessage[],
	modelName: string,
	options: ChatCompletionOptions | undefined,
	onToken: (chunk: string, fullText: string) => void
): Promise<string> {
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
			model: modelName,
			messages,
			stream: true,
			max_tokens: options?.maxTokens,
			temperature: options?.temperature ?? 0.2
		})
	});

	if (!response.ok) {
		throw new Error(`OpenAI chat stream failed: ${await response.text()}`);
	}

	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error('OpenAI stream body unavailable');
	}

	const decoder = new TextDecoder();
	let buffer = '';
	let full = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() ?? '';

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed.startsWith('data:')) {
				continue;
			}
			const data = trimmed.slice(5).trim();
			if (data === '[DONE]') {
				continue;
			}
			try {
				const payload = JSON.parse(data) as {
					choices?: Array<{ delta?: { content?: string } }>;
				};
				const piece = payload.choices?.[0]?.delta?.content ?? '';
				if (piece) {
					full += piece;
					onToken(piece, full);
				}
			} catch {
				// ignore
			}
		}
	}

	return full || 'A LLM nao retornou conteudo.';
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

async function createOpenAiChatCompletion(messages: ChatMessage[], modelName: string, options?: ChatCompletionOptions): Promise<string> {
	if (options?.stream && options.onToken) {
		return createOpenAiChatCompletionStream(messages, modelName, options, options.onToken);
	}

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
			model: modelName,
			messages,
			max_tokens: options?.maxTokens,
			temperature: options?.temperature ?? 0.2
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

async function createOllamaChatCompletion(messages: ChatMessage[], modelName: string, options?: ChatCompletionOptions): Promise<string> {
	if (options?.stream && options.onToken) {
		return createOllamaChatCompletionStream(messages, modelName, options, options.onToken);
	}

	const response = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: modelName,
			messages,
			stream: false,
			options: {
				temperature: options?.temperature ?? 0.2,
				...(options?.maxTokens !== undefined ? { num_predict: options.maxTokens } : {})
			}
		})
	});

	if (!response.ok) {
		throw new Error(`Ollama chat failed: ${await response.text()}`);
	}

	const payload = await response.json() as OllamaChatResponse;
	return payload.message?.content ?? payload.response ?? 'A LLM local nao retornou conteudo.';
}

function withAgentSystemPrompt(messages: ChatMessage[], systemPrompt: string): ChatMessage[] {
	const [first, ...rest] = messages;
	if (first?.role === 'system') {
		return [
			{
				role: 'system',
				content: `${systemPrompt}\n\n${first.content}`
			},
			...rest
		];
	}

	return [
		{
			role: 'system',
			content: systemPrompt
		},
		...messages
	];
}
