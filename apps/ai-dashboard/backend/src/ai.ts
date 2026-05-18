import { config } from './config.js';

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
		label: 'Princy Ai DeepSeek',
		modelName: config.ollamaChatModel,
		isLocal: true,
		systemPrompt: 'Voce e o Princy Ai, o agente principal deste editor, rodando sobre DeepSeek Coder local. Responda de forma direta, usando o contexto do projeto, priorizando codigo limpo, edicoes aplicaveis, arquitetura simples e passos executaveis.'
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

export async function createChatCompletion(messages: ChatMessage[], agent: AgentModel = 'princy'): Promise<string> {
	const agentConfig = agentConfigs[agent] ?? agentConfigs.princy;
	const preparedMessages = withAgentSystemPrompt(messages, agentConfig.systemPrompt);

	if (!agentConfig.isLocal || config.aiProvider === 'openai') {
		return createOpenAiChatCompletion(preparedMessages, agentConfig.modelName);
	}

	return createOllamaChatCompletion(preparedMessages, agentConfig.modelName);
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

async function createOpenAiChatCompletion(messages: ChatMessage[], modelName: string): Promise<string> {
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

async function createOllamaChatCompletion(messages: ChatMessage[], modelName: string): Promise<string> {
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
