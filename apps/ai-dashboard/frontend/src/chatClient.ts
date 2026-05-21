export type AgentId = 'princy' | 'deepseek' | 'qwen' | 'codellama' | 'llama3' | 'mistral' | 'openai';

export type AgentModelInfo = {
	readonly id: AgentId;
	readonly label: string;
	readonly modelName: string;
	readonly isLocal: boolean;
};

const TOKEN_KEY = 'princy_agent_token';

export function getAgentToken(): string {
	return localStorage.getItem(TOKEN_KEY) ?? '';
}

export function setAgentToken(token: string): void {
	const trimmed = token.trim();
	if (trimmed) {
		localStorage.setItem(TOKEN_KEY, trimmed);
	} else {
		localStorage.removeItem(TOKEN_KEY);
	}
}

function formatChatHttpError(status: number, body: string): string {
	if (status === 502 || status === 503) {
		return [
			`Erro ${status}: backend da IA nao respondeu.`,
			'1) Inicie: deploy\\windows\\agent-backend\\start-princy-agent-backend.ps1',
			'2) Teste: http://127.0.0.1:3210/api/agent/health',
			'3) Ollama: ollama pull deepseek-coder e servico em http://127.0.0.1:11434'
		].join(' ');
	}
	if (status === 401) {
		return 'Token da API invalido. Ajuste AGENT_API_TOKEN ou salve o token na sidebar do chat.';
	}
	try {
		const json = JSON.parse(body) as { message?: string };
		if (json.message) {
			return json.message;
		}
	} catch {
		// not json
	}
	return body.trim() || `Erro HTTP ${status}`;
}

function buildHeaders(): HeadersInit {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		Accept: 'application/json'
	};
	const token = getAgentToken();
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}
	return headers;
}

export type BootstrapInfo = {
	readonly ok: boolean;
	readonly publicChat: boolean;
	readonly needsToken: boolean;
	readonly defaultAgent: AgentId;
	readonly simpleMode: boolean;
};

export async function fetchAgentHealth(): Promise<{ ok: boolean; service?: string }> {
	const response = await fetch('/api/agent/health', { headers: buildHeaders() });
	if (!response.ok) {
		throw new Error(formatChatHttpError(response.status, await response.text()));
	}
	return response.json() as Promise<{ ok: boolean; service?: string }>;
}

export async function fetchBootstrap(): Promise<BootstrapInfo> {
	const response = await fetch('/api/agent/bootstrap');
	if (!response.ok) {
		throw new Error(`Bootstrap failed (${response.status})`);
	}
	return response.json() as Promise<BootstrapInfo>;
}

export async function fetchModels(): Promise<readonly AgentModelInfo[]> {
	const response = await fetch('/api/agent/models', { headers: buildHeaders() });
	if (!response.ok) {
		const text = await response.text();
		throw new Error(formatChatHttpError(response.status, text));
	}
	const data = await response.json() as { models: AgentModelInfo[] };
	return data.models;
}

export type AgentChatResult = {
	readonly content: string;
	readonly message?: string;
	readonly intelligence_status?: string;
};

export async function postAgentChat(input: {
	readonly agent: AgentId;
	readonly message: string;
}): Promise<AgentChatResult> {
	const response = await fetch('/api/agent/chat', {
		method: 'POST',
		headers: buildHeaders(),
		body: JSON.stringify({
			agent: input.agent,
			message: input.message,
			priority: 'normal'
		})
	});
	if (!response.ok) {
		const text = await response.text();
		throw new Error(formatChatHttpError(response.status, text));
	}
	return response.json() as Promise<AgentChatResult>;
}

export type StreamHandlers = {
	readonly onDelta: (text: string) => void;
	readonly onStatus?: (text: string) => void;
	readonly onDone: (final: AgentChatResult) => void;
};

export async function streamAgentChat(input: {
	readonly agent: AgentId;
	readonly message: string;
}, handlers: StreamHandlers): Promise<void> {
	const response = await fetch('/api/agent/chat/stream', {
		method: 'POST',
		headers: buildHeaders(),
		body: JSON.stringify({
			agent: input.agent,
			message: input.message,
			priority: 'normal',
			stream: true
		})
	});

	if (!response.ok || !response.body) {
		const text = await response.text();
		throw new Error(formatChatHttpError(response.status, text));
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	let finalText = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() ?? '';

		for (const line of lines) {
			if (!line.startsWith('data: ')) {
				continue;
			}
			try {
				const payload = JSON.parse(line.slice(6)) as {
					type?: string;
					text?: string;
					metadata?: unknown;
				};
				if (payload.type === 'delta' && typeof payload.text === 'string') {
					finalText = payload.text;
					handlers.onDelta(payload.text);
				} else if (payload.type === 'message' && typeof payload.text === 'string') {
					finalText = payload.text;
					handlers.onDelta(payload.text);
				} else if (payload.type === 'intelligence_status' && typeof payload.text === 'string') {
					handlers.onStatus?.(payload.text);
				} else if (payload.type === 'error' && typeof payload.text === 'string') {
					throw new Error(payload.text);
				} else if (payload.type === 'done') {
					handlers.onDone({ content: finalText, message: finalText });
				}
			} catch {
				// ignore malformed SSE lines
			}
		}
	}

	if (!finalText) {
		handlers.onDone({ content: '', message: '' });
	}
}
