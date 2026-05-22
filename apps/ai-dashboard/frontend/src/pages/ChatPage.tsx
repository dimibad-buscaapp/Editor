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
import { ChatComposer, ChatMessageBubble, newChatMessageId, type ChatUiMessage } from '../chatUi.js';
import { navigate } from '../router.js';
import { resolveEditorUrl } from '../princyHosts.js';
import { api, type User } from '../api.js';

const EDITOR_URL = typeof window !== 'undefined'
	? resolveEditorUrl(window.location.hostname, window.location.origin)
	: 'https://princyai.com/webeditor/';

export function ChatPage(props?: {
	readonly user?: User;
	readonly onLogout?: () => void;
}): ReactElement {
	const [models, setModels] = useState<readonly AgentModelInfo[]>([]);
	const [agent, setAgent] = useState<AgentId>('deepseek');
	const [messages, setMessages] = useState<readonly ChatUiMessage[]>([
		{
			id: newChatMessageId(),
			role: 'assistant',
			content: props?.user
				? `Ola, ${props.user.name}. Chat Princy Ai com o mesmo visual do assistente — escolha o modelo e envie.`
				: 'Ola. Sou o Princy Ai — chat direto na porta 3210. Escolha o modelo, descreva a tarefa e envie.'
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
						id: newChatMessageId(),
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

		const userMsg: ChatUiMessage = { id: newChatMessageId(), role: 'user', content: text };
		const assistantId = newChatMessageId();
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
					id: newChatMessageId(),
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

	function newChat(): void {
		setMessages([{
			id: newChatMessageId(),
			role: 'assistant',
			content: 'Nova conversa. Como posso ajudar?'
		}]);
		setStatusLine('');
	}

	async function logout(): Promise<void> {
		try {
			await api.logout();
		} catch {
			// ignore
		}
		props?.onLogout?.();
		navigate('login');
	}

	return (
		<div className="chat-app">
			<aside className="chat-sidebar">
				<div className="chat-brand">
					<span className="chat-logo" aria-hidden="true">P</span>
					<div>
						<strong>Princy Ai</strong>
						<span className="muted">
							{props?.user ? 'Dashboard · Chat IA' : 'Chat · porta 3210'}
						</span>
					</div>
				</div>

				{props?.user ? (
					<div className="chat-user-card">
						<p className="chat-user-name">{props.user.name}</p>
						<p className="chat-user-email muted">{props.user.email}</p>
					</div>
				) : null}

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
					<a href="/logview/?autostart=1" target="_blank" rel="noreferrer">Starter Log (sistema)</a>
					{props?.user ? (
						<button type="button" onClick={() => navigate('workspace')}>Arquivos / workspace</button>
					) : null}
					<button type="button" onClick={() => navigate('hub')}>Hub</button>
					{!props?.user ? (
						<button type="button" onClick={() => navigate('login')}>Login</button>
					) : null}
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

				{props?.user && props.onLogout ? (
					<button type="button" className="chat-side-btn ghost chat-logout" onClick={() => void logout()}>
						Sair
					</button>
				) : null}
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
						<ChatMessageBubble key={msg.id} message={msg} busy={busy} />
					))}
				</div>

				<ChatComposer
					input={input}
					busy={busy}
					onInput={setInput}
					onSend={() => void send()}
					inputRef={inputRef}
					hint="Estilo Cursor · motores DeepSeek, Qwen, Princy consenso"
				/>
			</section>
		</div>
	);
}
