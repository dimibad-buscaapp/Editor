/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export type ChatMode = 'chat' | 'composer' | 'agent' | 'builder' | 'buildCenter' | 'apiStudio' | 'creator';

export interface ChatMessageTurn {
	readonly role: 'user' | 'assistant';
	readonly text: string;
}

export interface ChatSession {
	readonly id: string;
	title: string;
	mode: ChatMode;
	messages: ChatMessageTurn[];
	readonly createdAt: number;
	updatedAt: number;
}

interface SessionStore {
	sessions: ChatSession[];
	activeId?: string;
}

const STORAGE_KEY = 'princyai.chat.sessions';
const MAX_SESSIONS = 50;

function newId(): string {
	return `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function titleFromText(text: string): string {
	const line = text.trim().split(/\r?\n/)[0] ?? 'Nova conversa';
	return line.length > 48 ? `${line.slice(0, 45)}…` : line || 'Nova conversa';
}

export class ChatSessionManager {
	private store: SessionStore;

	public constructor(private readonly globalState: vscode.Memento) {
		this.store = globalState.get<SessionStore>(STORAGE_KEY) ?? { sessions: [] };
		if (!this.store.sessions.length) {
			const session = this.createSessionInternal('chat');
			this.store.activeId = session.id;
			void this.persist();
		} else if (!this.store.activeId || !this.store.sessions.some(s => s.id === this.store.activeId)) {
			this.store.activeId = this.store.sessions[0]?.id;
		}
	}

	public list(): readonly ChatSession[] {
		return [...this.store.sessions].sort((a, b) => b.updatedAt - a.updatedAt);
	}

	public getActive(): ChatSession | undefined {
		const id = this.store.activeId;
		return id ? this.store.sessions.find(s => s.id === id) : undefined;
	}

	public getActiveId(): string | undefined {
		return this.store.activeId;
	}

	public create(mode: ChatMode = 'chat'): ChatSession {
		const session = this.createSessionInternal(mode);
		this.store.activeId = session.id;
		void this.persist();
		return session;
	}

	public switchTo(id: string): ChatSession | undefined {
		const session = this.store.sessions.find(s => s.id === id);
		if (!session) {
			return undefined;
		}
		this.store.activeId = id;
		void this.persist();
		return session;
	}

	public delete(id: string): void {
		this.store.sessions = this.store.sessions.filter(s => s.id !== id);
		if (this.store.activeId === id) {
			this.store.activeId = this.store.sessions[0]?.id;
			if (!this.store.activeId && this.store.sessions.length === 0) {
				const session = this.createSessionInternal('chat');
				this.store.activeId = session.id;
			}
		}
		void this.persist();
	}

	public setMode(id: string, mode: ChatMode): void {
		const session = this.store.sessions.find(s => s.id === id);
		if (!session) {
			return;
		}
		session.mode = mode;
		session.updatedAt = Date.now();
		void this.persist();
	}

	public appendMessage(id: string, turn: ChatMessageTurn): void {
		const session = this.store.sessions.find(s => s.id === id);
		if (!session) {
			return;
		}
		session.messages.push(turn);
		session.updatedAt = Date.now();
		if (turn.role === 'user' && (session.title === 'Nova conversa' || !session.title.trim())) {
			session.title = titleFromText(turn.text);
		}
		void this.persist();
	}

	public clearMessages(id: string): void {
		const session = this.store.sessions.find(s => s.id === id);
		if (!session) {
			return;
		}
		session.messages.length = 0;
		session.title = 'Nova conversa';
		session.updatedAt = Date.now();
		void this.persist();
	}

	private createSessionInternal(mode: ChatMode): ChatSession {
		const session: ChatSession = {
			id: newId(),
			title: 'Nova conversa',
			mode,
			messages: [],
			createdAt: Date.now(),
			updatedAt: Date.now()
		};
		this.store.sessions.unshift(session);
		if (this.store.sessions.length > MAX_SESSIONS) {
			this.store.sessions = this.store.sessions.slice(0, MAX_SESSIONS);
		}
		return session;
	}

	private async persist(): Promise<void> {
		await this.globalState.update(STORAGE_KEY, this.store);
	}
}
