import { useEffect, type ReactElement, type RefObject } from 'react';
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
						<div key={index} className="code-block">
							<div className="chat-code-header">
								<span>{lang}</span>
							</div>
							<pre>
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
		return 'Princy IA';
	}
	return 'Sistema';
}

export function ChatMessageBubble(props: {
	readonly message: ChatUiMessage;
	readonly streaming?: boolean;
}): ReactElement {
	const { message, streaming } = props;
	const isUser = message.role === 'user';
	const isAssistant = message.role === 'assistant';
	const isStreaming = Boolean(streaming && isAssistant);

	return (
		<div className={`chat-turn ${message.role}${isStreaming ? ' streaming' : ''}`}>
			<div className="chat-turn-header">
				<span className="chat-turn-avatar" aria-hidden="true">
					{isUser ? 'V' : isAssistant ? '✦' : '!'}
				</span>
				<span>{turnLabel(message.role)}</span>
			</div>
			<div className={`chat-turn-body${isStreaming && !message.content ? ' cursor-blink' : ''}`}>
				{message.content ? renderChatContent(message.content) : isStreaming ? (
					<span className="chat-stream-placeholder" />
				) : null}
				{message.status ? <p className="chat-meta">{message.status}</p> : null}
			</div>
		</div>
	);
}

const SUGGESTIONS = [
	{ label: 'Explicar codigo', prompt: 'Explique o projeto em poucas linhas e sugira melhorias.' },
	{ label: 'Corrigir bugs', prompt: 'Corrija erros e bugs no webeditor e no deploy do VPS.' },
	{ label: 'Refatorar', prompt: 'Refatore para codigo mais limpo e tipado.' },
	{ label: 'Gerar testes', prompt: 'Crie testes para o modulo principal do dashboard.' }
] as const;

export function ChatWelcome(props: {
	readonly onPick: (text: string) => void;
}): ReactElement {
	return (
		<div className="chat-welcome" id="chat-empty">
			<div className="chat-welcome-icon" aria-hidden="true">✦</div>
			<h2>Como posso ajudar?</h2>
			<p>Layout estilo Cursor — tema Princy Black, @contexto e Composer.</p>
			<div className="chat-suggestions">
				{SUGGESTIONS.map(({ label, prompt }) => (
					<button key={label} type="button" className="chat-suggest" onClick={() => props.onPick(prompt)}>
						{label}
					</button>
				))}
			</div>
		</div>
	);
}

export function ChatThinking(props: {
	readonly visible: boolean;
	readonly status?: string;
}): ReactElement {
	if (!props.visible) {
		return <div className="chat-thinking" hidden />;
	}
	return (
		<div className="chat-thinking" style={{ display: 'block' }}>
			<div className={`step active`}>{props.status || 'Pensando...'}</div>
		</div>
	);
}

function useAutoResizeTextarea(
	ref: RefObject<HTMLTextAreaElement | null>,
	value: string
): void {
	useEffect(() => {
		const el = ref.current;
		if (!el) {
			return;
		}
		el.style.height = 'auto';
		el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
	}, [ref, value]);
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
	readonly onQuickPrompt: (text: string) => void;
	readonly inputRef?: RefObject<HTMLTextAreaElement | null>;
}): ReactElement {
	useAutoResizeTextarea(props.inputRef ?? { current: null }, props.input);

	return (
		<div className="chat-composer">
			<div className="chat-followups">
				<button type="button" className="chat-followup-btn" onClick={() => props.onQuickPrompt('@workspace ')}>
					@workspace
				</button>
				<button type="button" className="chat-followup-btn" onClick={() => props.onQuickPrompt('/fix ')}>
					/fix
				</button>
				<button type="button" className="chat-followup-btn" onClick={() => props.onQuickPrompt('/explain ')}>
					/explain
				</button>
				<button type="button" className="chat-followup-btn" onClick={() => props.onQuickPrompt('/composer ')}>
					/composer
				</button>
			</div>
			<div className="chat-input-container">
				<label className="chat-sr-only" htmlFor="princy-chat-input">Mensagem</label>
				<textarea
					id="princy-chat-input"
					ref={props.inputRef}
					value={props.input}
					onChange={e => props.onInput(e.target.value)}
					onKeyDown={e => {
						if (e.key === 'Enter' && !e.shiftKey) {
							e.preventDefault();
							props.onSend();
						}
					}}
					placeholder="Pergunte, @arquivo, /fix ou /composer…"
					rows={1}
					disabled={props.busy}
				/>
				<div className="chat-input-toolbar">
					<div className="chat-toolbar-left">
						<span
							className={`chat-backend-dot${props.backendOnline ? ' online' : ''}`}
							title={props.backendOnline ? 'Backend online' : 'Backend offline'}
							aria-hidden="true"
						/>
						<label className="chat-sr-only" htmlFor="chat-model-select">Modelo</label>
						<select
							id="chat-model-select"
							className="chat-model-select"
							value={props.agent}
							onChange={e => props.onAgentChange(e.target.value as AgentId)}
							disabled={props.busy}
						>
							{props.models.length === 0 ? (
								<option value="deepseek">DeepSeek</option>
							) : (
								props.models.map(m => (
									<option key={m.id} value={m.id}>{m.label}</option>
								))
							)}
						</select>
						<span className="chat-status">{props.statusLine || 'Pronto'}</span>
					</div>
					<div className="chat-toolbar-right">
						<button
							type="button"
							className="chat-send-btn"
							onClick={props.onSend}
							disabled={props.busy || !props.input.trim()}
							title="Enviar"
							aria-label="Enviar"
						>
							{props.busy ? <span className="chat-send-spinner" aria-hidden="true" /> : '↑'}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
