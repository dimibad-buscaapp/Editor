import type { ReactElement, RefObject } from 'react';

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

export function ChatMessageBubble(props: {
	readonly message: ChatUiMessage;
	readonly busy?: boolean;
}): ReactElement {
	const { message, busy } = props;
	return (
		<article key={message.id} className={`chat-bubble ${message.role}`}>
			<div className="chat-avatar" aria-hidden="true">
				{message.role === 'user' ? 'Voce' : message.role === 'assistant' ? 'AI' : '!'}
			</div>
			<div className="chat-bubble-body">
				{message.content ? renderChatContent(message.content) : busy && message.role === 'assistant' ? (
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

export function ChatComposer(props: {
	readonly input: string;
	readonly busy: boolean;
	readonly placeholder?: string;
	readonly hint?: string;
	readonly onInput: (value: string) => void;
	readonly onSend: () => void;
	readonly inputRef?: RefObject<HTMLTextAreaElement | null>;
}): ReactElement {
	return (
		<footer className="chat-composer">
			<div className="chat-composer-inner">
				<textarea
					ref={props.inputRef}
					value={props.input}
					onChange={e => props.onInput(e.target.value)}
					onKeyDown={e => {
						if (e.key === 'Enter' && !e.shiftKey) {
							e.preventDefault();
							props.onSend();
						}
					}}
					placeholder={props.placeholder ?? 'Pergunte qualquer coisa — Enter envia, Shift+Enter nova linha'}
					rows={1}
					disabled={props.busy}
				/>
				<button
					type="button"
					className={`chat-send${props.busy ? ' is-busy' : ''}`}
					onClick={props.onSend}
					disabled={props.busy || !props.input.trim()}
				>
					{props.busy ? <span className="chat-send-spinner" aria-hidden="true" /> : null}
					<span>{props.busy ? 'Enviando' : 'Enviar'}</span>
				</button>
			</div>
			{props.hint ? <p className="chat-hint muted">{props.hint}</p> : null}
		</footer>
	);
}
