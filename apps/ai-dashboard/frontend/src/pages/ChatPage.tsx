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
import {
	ChatComposer,
	ChatMessageBubble,
	ChatWelcome,
	newChatMessageId,
	type ChatUiMessage
} from '../chatUi.js';
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
	const [messages, setMessages] = useState<readonly ChatUiMessage[]>([]);
	const [input, setInput] = useState('');
	const [busy, setBusy] = useState(false);
	const [statusLine, setStatusLine] = useState('');
	const [needsToken, setNeedsToken] = useState(false);
	const [tokenDraft, setTokenDraft] = useState(() => getAgentToken());
	const [showToken, setShowToken] = useState(false);
	const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	const showWelcome = messages.length === 0;

	useEffect(() => {
		document.body.classList.add('chat-body');
		document.documentElement.classList.add('chat-body');
		return () => {
			document.body.classList.remove('chat-body');
			document.documentElement.classList.remove('chat-body');
		};
	}, []);

	useEffect(() => {
		scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
	}, [messages, busy, showWelcome]);

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
					setMessages([{
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

	const send = useCallback(async (textOverride?: string) => {
		const text = (textOverride ?? input).trim();
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
		setMessages([]);
		setStatusLine('');
		setInput('');
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
					<span className="chat-logo" aria-hidden="true">◇</span>
					<div>
						<strong>Princy Ai</strong>
						<span className="muted">Chat</span>
					</div>
				</div>

				<button type="button" className="chat-side-btn primary" onClick={newChat}>
					<span className="chat-side-btn-icon" aria-hidden="true">+</span>
					Nova conversa
				</button>

				{props?.user ? (
					<div className="chat-user-card">
						<p className="chat-user-name">{props.user.name}</p>
						<p className="chat-user-email muted">{props.user.email}</p>
					</div>
				) : null}

				<nav className="chat-nav">
					<a href={EDITOR_URL} target="_blank" rel="noreferrer">Editor Code Web</a>
					<a href="/logview/?autostart=1" target="_blank" rel="noreferrer">Starter Log</a>
					{props?.user ? (
						<button type="button" onClick={() => navigate('workspace')}>Workspace</button>
					) : null}
					{!props?.user ? (
						<button type="button" onClick={() => navigate('login')}>Login</button>
					) : null}
					<button type="button" onClick={() => navigate('logs')}>Logs</button>
				</nav>

				{(needsToken || getAgentToken()) && (
					<div className="chat-token">
						<button type="button" className="chat-side-btn ghost" onClick={() => setShowToken(v => !v)}>
							{showToken ? 'Ocultar token' : 'Token API'}
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
					<div className="chat-topbar-title">
						<h1>Chat</h1>
						<span className="chat-topbar-sub muted">Assistente IA</span>
					</div>
					{backendOnline === false ? (
						<span className="chat-topbar-badge error">Offline</span>
					) : backendOnline ? (
						<span className="chat-topbar-badge ok">Online</span>
					) : null}
				</header>

				{backendOnline === false ? (
					<div className="chat-banner error">
						Backend offline na 3210. Confira PrincyAiAgentBackend e Ollama.
					</div>
				) : null}

				<div className="chat-thread" ref={scrollRef}>
					{showWelcome ? (
						<ChatWelcome onPick={text => void send(text)} />
					) : (
						messages.map(msg => (
							<ChatMessageBubble key={msg.id} message={msg} busy={busy} />
						))
					)}
				</div>

				<ChatComposer
					input={input}
					busy={busy}
					agent={agent}
					models={models}
					statusLine={statusLine}
					backendOnline={backendOnline}
					onAgentChange={setAgent}
					onInput={setInput}
					onSend={() => void send()}
					inputRef={inputRef}
				/>
			</section>
		</div>
	);
}
