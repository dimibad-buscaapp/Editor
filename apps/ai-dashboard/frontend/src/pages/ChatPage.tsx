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
	ChatThinking,
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

const LOGVIEW_URL = typeof window !== 'undefined'
	? `${window.location.origin}/logview/?autostart=1`
	: 'https://princyai.com/logview/?autostart=1';

export function ChatPage(props?: {
	readonly user?: User;
	readonly onLogout?: () => void;
}): ReactElement {
	const [models, setModels] = useState<readonly AgentModelInfo[]>([]);
	const [agent, setAgent] = useState<AgentId>('deepseek');
	const [messages, setMessages] = useState<readonly ChatUiMessage[]>([]);
	const [input, setInput] = useState('');
	const [busy, setBusy] = useState(false);
	const [statusLine, setStatusLine] = useState('Pronto');
	const [needsToken, setNeedsToken] = useState(false);
	const [tokenDraft, setTokenDraft] = useState(() => getAgentToken());
	const [showToken, setShowToken] = useState(false);
	const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	const showWelcome = messages.length === 0;
	const streamingId = busy
		? [...messages].reverse().find(m => m.role === 'assistant')?.id
		: undefined;

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
	}, [messages, busy, showWelcome, statusLine]);

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
					setStatusLine('Pronto');
				}
				const list = await fetchModels();
				if (!cancelled) {
					setModels(list);
				}
			} catch (error) {
				if (!cancelled) {
					setBackendOnline(false);
					setStatusLine('Offline');
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
					setStatusLine('Pronto');
				}
			});
		} catch {
			try {
				const result = await postAgentChat({ agent, message: text });
				patchAssistant(result.content || result.message || '');
				setStatusLine(result.intelligence_status || 'Pronto');
			} catch (error) {
				patchAssistant('');
				setMessages(prev => [...prev, {
					id: newChatMessageId(),
					role: 'system',
					content: error instanceof Error ? error.message : 'Erro no chat'
				}]);
				setStatusLine('Erro');
			}
		} finally {
			setBusy(false);
			inputRef.current?.focus();
		}
	}, [agent, busy, input]);

	function newChat(): void {
		setMessages([]);
		setStatusLine('Pronto');
		setInput('');
		inputRef.current?.focus();
	}

	function quickPrompt(prefix: string): void {
		setInput(prev => (prev.trim() ? `${prev} ${prefix}` : prefix).trimStart());
		inputRef.current?.focus();
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
		<div className="chat-panel">
			<header className="chat-header">
				<div className="chat-header-brand">
					<span className="chat-header-logo" aria-hidden="true">✦</span>
					<div>
						<div className="chat-header-title">Princy IA</div>
						<div className="chat-header-sub">Agent · Composer · Black</div>
					</div>
				</div>
				<div className="chat-header-actions">
					<a className="chat-header-btn" href={EDITOR_URL} target="_blank" rel="noreferrer">Editor</a>
					<a className="chat-header-btn" href={LOGVIEW_URL} target="_blank" rel="noreferrer">Log</a>
					{props?.user ? (
						<button type="button" className="chat-header-btn" onClick={() => navigate('workspace')}>Workspace</button>
					) : (
						<button type="button" className="chat-header-btn" onClick={() => navigate('login')}>Login</button>
					)}
					<button type="button" className="chat-header-btn" onClick={() => navigate('logs')}>Diag</button>
					{(needsToken || getAgentToken()) && (
						<button type="button" className="chat-header-btn" onClick={() => setShowToken(v => !v)}>Token</button>
					)}
					<button type="button" className="chat-header-btn" onClick={newChat} title="Nova conversa">+ Novo</button>
				</div>
			</header>

			{showToken && (
				<div className="chat-token-bar">
					<input
						type="password"
						placeholder="Bearer AGENT_API_TOKEN"
						value={tokenDraft}
						onChange={e => setTokenDraft(e.target.value)}
					/>
					<button type="button" className="chat-header-btn" onClick={() => { setAgentToken(tokenDraft); setShowToken(false); }}>
						Salvar
					</button>
				</div>
			)}

			{backendOnline === false ? (
				<div className="chat-boot-error">
					Backend offline na 3210. Confira PrincyAiAgentBackend, Ollama e <code>npm run build:frontend</code>.
				</div>
			) : null}

			<div className="chat-scroll" ref={scrollRef}>
				{showWelcome ? <ChatWelcome onPick={text => void send(text)} /> : null}
				<div className="chat-turn-list">
					{messages.map(msg => (
						<ChatMessageBubble
							key={msg.id}
							message={msg}
							streaming={msg.id === streamingId}
						/>
					))}
				</div>
				<ChatThinking visible={busy} status={statusLine} />
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
				onQuickPrompt={quickPrompt}
				inputRef={inputRef}
			/>

			{props?.user ? (
				<footer className="chat-footer-user">
					<span>{props.user.name}</span>
					{props.onLogout ? (
						<button type="button" className="chat-header-btn" onClick={() => void logout()}>Sair</button>
					) : null}
				</footer>
			) : null}
		</div>
	);
}
