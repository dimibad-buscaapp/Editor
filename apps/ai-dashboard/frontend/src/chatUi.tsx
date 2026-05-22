import type { ReactElement, RefObject } from 'react';
import type { AgentId, AgentModelInfo } from './chatClient.js';

export type ChatUiMessage = {
	readonly id: string;
	readonly role: 'user' | 'assistant' | 'system';
	readonly content: string;
	readonly status?: string;
};

export function newChatMessageId(): string {
	return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function renderChatContent(text: string): ReactElement {
	const parts = text.split(/(```[\s\S]*?```)/g);
	return (
		<>
			{parts.map((part, index) => {
				const fence = /^```(\w+)?\s*([\s\S]*?)```$/m.exec(part.trim());
				if (fence) {
					const lang = fence[1] ?? 'code';
					return (
						<div key={index} className="chat-code-block">
							<div className="chat-code-header">
								<span>{lang}</span>
							</div>
							<pre className="chat-code">
								<code>{fence[2].trim()}</code>
							</pre>
						</div>
					);
				}
				if (!part.trim()) {
					return null;
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

function turnLabel(role: ChatUiMessage['role']): string {
	if (role === 'user') {
		return 'Voce';
	}
	if (role === 'assistant') {
		return 'Princy';
	}
	return 'Sistema';
}

export function ChatMessageBubble(props: {
	readonly message: ChatUiMessage;
	readonly busy?: boolean;
}): ReactElement {
	const { message, busy } = props;
	const isUser = message.role === 'user';
	const isAssistant = message.role === 'assistant';

	return (
		<article className={`chat-turn ${message.role}`}>
			<header className="chat-turn-header">
				<span className="chat-turn-avatar" aria-hidden="true">
					{isUser ? 'V' : isAssistant ? 'P' : '!'}
				</span>
				<span className="chat-turn-name">{turnLabel(message.role)}</span>
			</header>
			<div className="chat-turn-body">
				{message.content ? renderChatContent(message.content) : busy && isAssistant ? (
					<p className="chat-typing">
						<span className="chat-typing-dots" aria-hidden="true">
							<span /><span /><span />
						</span>
						Gerando resposta...
					</p>
				) : null}
				{message.status ? <p className="chat-meta">{message.status}</p> : null}
			</div>
		</article>
	);
}

const SUGGESTIONS = [
	'Explicar este projeto em poucas linhas',
	'Gerar um plano para corrigir o webeditor',
	'Revisar erros no code-web.err.log',
	'Criar um script PowerShell para o VPS'
] as const;

export function ChatWelcome(props: {
	readonly onPick: (text: string) => void;
}): ReactElement {
	return (
		<div className="chat-welcome">
			<div className="chat-welcome-icon" aria-hidden="true">◇</div>
			<h2>Princy Ai</h2>
			<p>Pergunte qualquer coisa. Estilo Cursor / VS Code — tema Black.</p>
			<div className="chat-suggestions">
				{SUGGESTIONS.map(text => (
					<button key={text} type="button" className="chat-suggest" onClick={() => props.onPick(text)}>
						{text}
					</button>
				))}
			</div>
		</div>
	);
}

export function ChatComposer(props: {
	readonly input: string;
	readonly busy: boolean;
	readonly agent: AgentId;
	readonly models: readonly AgentModelInfo[];
	readonly statusLine?: string;
	readonly backendOnline?: boolean | null;
	readonly onAgentChange: (agent: AgentId) => void;
	readonly onInput: (value: string) => void;
	readonly onSend: () => void;
	readonly inputRef?: RefObject<HTMLTextAreaElement | null>;
}): ReactElement {
	return (
		<footer className="chat-composer">
			<div className="chat-input-container">
				<textarea
					ref={props.inputRef}
					className="chat-input"
					value={props.input}
					onChange={e => props.onInput(e.target.value)}
					onKeyDown={e => {
						if (e.key === 'Enter' && !e.shiftKey) {
							e.preventDefault();
							props.onSend();
						}
					}}
					placeholder="Pergunte, @ para contexto, / para comandos"
					rows={1}
					disabled={props.busy}
				/>
				<div className="chat-input-toolbar">
					<div className="chat-toolbar-left">
						<label className="chat-sr-only" htmlFor="chat-model-select">Modelo</label>
						<select
							id="chat-model-select"
							className="chat-model-select"
							value={props.agent}
							onChange={e => props.onAgentChange(e.target.value as AgentId)}
							disabled={props.busy}
						>
							{props.models.length === 0 ? (
								<option value="deepseek">DeepSeek Coder</option>
							) : (
								props.models.map(m => (
									<option key={m.id} value={m.id}>{m.label}</option>
								))
							)}
						</select>
						<span
							className={`chat-backend-dot${props.backendOnline ? ' online' : ''}`}
							title={props.backendOnline ? 'Backend online' : 'Backend offline'}
							aria-hidden="true"
						/>
						{props.statusLine ? <span className="chat-status-line">{props.statusLine}</span> : null}
					</div>
					<div className="chat-toolbar-right">
						<button
							type="button"
							className={`chat-send-btn${props.busy ? ' is-busy' : ''}`}
							onClick={props.onSend}
							disabled={props.busy || !props.input.trim()}
							title="Enviar"
							aria-label="Enviar"
						>
							{props.busy ? <span className="chat-send-spinner" aria-hidden="true" /> : (
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
									<path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
								</svg>
							)}
						</button>
					</div>
				</div>
			</div>
			<p className="chat-hint muted">Enter envia · Shift+Enter nova linha · tema Princy Black</p>
		</footer>
	);
}
