import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import {
	type AgentId,
	type AgentModelInfo,
	fetchAgentHealth,
	fetchBootstrap,
	fetchModels,
	getAgentToken,
	postAgentChat,
	setAgentToken,
	streamAgentChat
} from '../chatClient.js';
import { navigate } from '../router.js';

type ChatMessage = {
	readonly id: string;
	readonly role: 'user' | 'assistant' | 'system';
	readonly content: string;
	readonly status?: string;
};

function newId(): string {
	return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function renderContent(text: string): ReactElement {
	const parts = text.split(/(```[\s\S]*?```)/g);
	return (
		<>
			{parts.map((part, index) => {
				const fence = /^```(\w+)?\s*([\s\S]*?)```$/m.exec(part.trim());
				if (fence) {
					return (
						<pre key={index} className="chat-code">
							<code>{fence[2].trim()}</code>
						</pre>
					);
				}
				return (
					<p key={index} className="chat-paragraph">
						{part}
					</p>
				);
			})}
		</>
	);
}

const EDITOR_URL = typeof window !== 'undefined'
	&& (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
	? 'http://127.0.0.1:3200'
	: `${window.location.origin}/webeditor/`;

export function ChatPage(): ReactElement {
	const [models, setModels] = useState<readonly AgentModelInfo[]>([]);
	const [agent, setAgent] = useState<AgentId>('deepseek');
	const [messages, setMessages] = useState<readonly ChatMessage[]>([
		{
			id: newId(),
			role: 'assistant',
			content: 'Ola. Sou o Princy Ai — chat direto na porta 3210. Escolha o modelo, descreva a tarefa e envie.'
		}
	]);
	const [input, setInput] = useState('');
	const [busy, setBusy] = useState(false);
	const [statusLine, setStatusLine] = useState('');
	const [needsToken, setNeedsToken] = useState(false);
	const [tokenDraft, setTokenDraft] = useState(() => getAgentToken());
	const [showToken, setShowToken] = useState(false);
	const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		document.body.classList.add('chat-body');
		return () => document.body.classList.remove('chat-body');
	}, []);

	useEffect(() => {
		scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
	}, [messages, busy]);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const boot = await fetchBootstrap();
				if (cancelled) {
					return;
				}
				setNeedsToken(boot.needsToken);
				setAgent(boot.defaultAgent);
				await fetchAgentHealth();
				if (!cancelled) {
					setBackendOnline(true);
				}
				const list = await fetchModels();
				if (!cancelled) {
					setModels(list);
				}
			} catch (error) {
				if (!cancelled) {
					setBackendOnline(false);
					setMessages(prev => [...prev, {
						id: newId(),
						role: 'system',
						content: error instanceof Error ? error.message : 'Falha ao conectar ao backend na porta 3210'
					}]);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const send = useCallback(async () => {
		const text = input.trim();
		if (!text || busy) {
			return;
		}

		const userMsg: ChatMessage = { id: newId(), role: 'user', content: text };
		const assistantId = newId();
		setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }]);
		setInput('');
		setBusy(true);
		setStatusLine('Pensando...');

		const patchAssistant = (content: string, status?: string) => {
			setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content, status } : m));
		};

		try {
			await streamAgentChat({ agent, message: text }, {
				onDelta: patchAssistant,
				onStatus: setStatusLine,
				onDone: result => {
					patchAssistant(result.content || result.message || '(sem resposta)');
					setStatusLine('');
				}
			});
		} catch {
			try {
				const result = await postAgentChat({ agent, message: text });
				patchAssistant(result.content || result.message || '');
				setStatusLine(result.intelligence_status ?? '');
			} catch (error) {
				patchAssistant('');
				setMessages(prev => [...prev, {
					id: newId(),
					role: 'system',
					content: error instanceof Error ? error.message : 'Erro no chat'
				}]);
				setStatusLine('');
			}
		} finally {
			setBusy(false);
			inputRef.current?.focus();
		}
	}, [agent, busy, input]);

	function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			void send();
		}
	}

	function newChat(): void {
		setMessages([{
			id: newId(),
			role: 'assistant',
			content: 'Nova conversa. Como posso ajudar?'
		}]);
		setStatusLine('');
	}

	return (
		<div className="chat-app">
			<aside className="chat-sidebar">
				<div className="chat-brand">
					<span className="chat-logo" aria-hidden="true">P</span>
					<div>
						<strong>Princy Ai</strong>
						<span className="muted">Chat · porta 3210</span>
					</div>
				</div>

				<button type="button" className="chat-side-btn primary" onClick={newChat}>
					+ Nova conversa
				</button>

				<label className="chat-field">
					<span>Modelo</span>
					<select value={agent} onChange={e => setAgent(e.target.value as AgentId)} disabled={busy}>
						{models.length === 0 ? (
							<option value="deepseek">DeepSeek Coder</option>
						) : (
							models.map(m => (
								<option key={m.id} value={m.id}>{m.label}</option>
							))
						)}
					</select>
				</label>

				<nav className="chat-nav">
					<a href={EDITOR_URL} target="_blank" rel="noreferrer">Editor Code Web</a>
					<button type="button" onClick={() => navigate('hub')}>Hub</button>
					<button type="button" onClick={() => navigate('login')}>Login</button>
					<button type="button" onClick={() => navigate('logs')}>Logs</button>
				</nav>

				{(needsToken || getAgentToken()) && (
					<div className="chat-token">
						<button type="button" className="chat-side-btn ghost" onClick={() => setShowToken(v => !v)}>
							{showToken ? 'Ocultar token API' : 'Token API (opcional)'}
						</button>
						{showToken && (
							<>
								<input
									type="password"
									placeholder="Bearer AGENT_API_TOKEN"
									value={tokenDraft}
									onChange={e => setTokenDraft(e.target.value)}
								/>
								<button
									type="button"
									className="chat-side-btn"
									onClick={() => {
										setAgentToken(tokenDraft);
										setShowToken(false);
									}}
								>
									Salvar
								</button>
							</>
						)}
					</div>
				)}
			</aside>

			<section className="chat-main">
				<header className="chat-topbar">
					<h1>Assistente</h1>
					{statusLine ? <span className="chat-status">{statusLine}</span> : null}
				</header>
				{backendOnline === false ? (
					<div className="chat-banner error">
						Backend offline na 3210. Rode start-princy-agent-backend.ps1 e confira Ollama (ollama pull deepseek-coder).
					</div>
				) : null}

				<div className="chat-thread" ref={scrollRef}>
					{messages.map(msg => (
						<article key={msg.id} className={`chat-bubble ${msg.role}`}>
							<div className="chat-avatar" aria-hidden="true">
								{msg.role === 'user' ? 'Voce' : msg.role === 'assistant' ? 'AI' : '!'}
							</div>
							<div className="chat-bubble-body">
								{msg.content ? renderContent(msg.content) : busy && msg.role === 'assistant' ? (
									<p className="chat-typing">Gerando resposta...</p>
								) : null}
								{msg.status ? <p className="chat-meta">{msg.status}</p> : null}
							</div>
						</article>
					))}
				</div>

				<footer className="chat-composer">
					<div className="chat-composer-inner">
						<textarea
							ref={inputRef}
							value={input}
							onChange={e => setInput(e.target.value)}
							onKeyDown={onKeyDown}
							placeholder="Pergunte qualquer coisa — Enter envia, Shift+Enter nova linha"
							rows={1}
							disabled={busy}
						/>
						<button type="button" className="chat-send" onClick={() => void send()} disabled={busy || !input.trim()}>
							{busy ? '...' : 'Enviar'}
						</button>
					</div>
					<p className="chat-hint muted">Estilo Cursor · motores DeepSeek, Qwen, Princy consenso</p>
				</footer>
			</section>
		</div>
	);
}
