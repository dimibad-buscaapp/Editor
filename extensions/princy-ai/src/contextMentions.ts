/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { ShadowContext } from './agentClient';

export type MentionKind = 'file' | 'folder' | 'terminal' | 'selection' | 'codebase';

export interface ContextAttachment {
	readonly kind: MentionKind;
	readonly label: string;
	readonly content: string;
}

const MENTION_PATTERN = /@(file|folder|terminal|selection|codebase)(?::([^\s@]+))?/gi;
const MAX_FILE_CHARS = 24_000;
const MAX_FOLDER_FILES = 12;
const MAX_FOLDER_FILE_CHARS = 8_000;

export async function resolveContextMentions(
	message: string,
	shadowContext?: ShadowContext
): Promise<{ readonly cleanMessage: string; readonly attachments: readonly ContextAttachment[] }> {
	const attachments: ContextAttachment[] = [];
	let cleanMessage = message;
	const seen = new Set<string>();

	for (const match of message.matchAll(MENTION_PATTERN)) {
		const kind = match[1]?.toLowerCase() as MentionKind;
		const arg = match[2]?.trim();
		const key = `${kind}:${arg ?? ''}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);

		const resolved = await resolveOne(kind, arg, shadowContext);
		if (resolved) {
			attachments.push(resolved);
		}
	}

	cleanMessage = cleanMessage.replace(MENTION_PATTERN, '').replace(/\s{2,}/g, ' ').trim();
	return { cleanMessage, attachments };
}

async function resolveOne(
	kind: MentionKind,
	arg: string | undefined,
	shadowContext?: ShadowContext
): Promise<ContextAttachment | undefined> {
	switch (kind) {
		case 'file':
			return resolveFile(arg);
		case 'folder':
			return resolveFolder(arg);
		case 'terminal':
			return resolveTerminal(shadowContext);
		case 'selection':
			return resolveSelection(shadowContext);
		case 'codebase':
			return resolveCodebase();
		default:
			return undefined;
	}
}

async function resolveFile(relativePath?: string): Promise<ContextAttachment | undefined> {
	const uri = await pickFileUri(relativePath);
	if (!uri) {
		return undefined;
	}
	const document = await vscode.workspace.openTextDocument(uri);
	const relative = vscode.workspace.asRelativePath(uri, false);
	return {
		kind: 'file',
		label: relative,
		content: `[@file:${relative}]\n${document.getText().slice(0, MAX_FILE_CHARS)}`
	};
}

async function resolveFolder(relativePath?: string): Promise<ContextAttachment | undefined> {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) {
		return undefined;
	}
	const pattern = relativePath ? `${relativePath.replace(/\\/g, '/')}/**/*` : '**/*';
	const files = await vscode.workspace.findFiles(
		pattern,
		'{**/node_modules/**,**/.git/**,**/out/**,**/dist/**,**/.build/**}',
		MAX_FOLDER_FILES
	);
	const parts: string[] = [];
	for (const uri of files) {
		const rel = vscode.workspace.asRelativePath(uri, false);
		try {
			const doc = await vscode.workspace.openTextDocument(uri);
			parts.push(`--- ${rel} ---\n${doc.getText().slice(0, MAX_FOLDER_FILE_CHARS)}`);
		} catch {
			parts.push(`--- ${rel} ---\n(unreadable)`);
		}
	}
	return {
		kind: 'folder',
		label: relativePath ?? folder.name,
		content: `[@folder:${relativePath ?? '.'}]\n${parts.join('\n\n')}`
	};
}

function resolveTerminal(shadowContext?: ShadowContext): ContextAttachment | undefined {
	const terminal = shadowContext?.lastTerminalResult;
	if (!terminal) {
		return {
			kind: 'terminal',
			label: 'terminal',
			content: '[@terminal]\n(nenhum resultado de terminal recente)'
		};
	}
	return {
		kind: 'terminal',
		label: 'terminal',
		content: `[@terminal]\nComando: ${terminal.command}\nExit: ${terminal.exitCode ?? '?'}\n${terminal.output.slice(0, 12_000)}`
	};
}

function resolveSelection(shadowContext?: ShadowContext): ContextAttachment | undefined {
	const editor = vscode.window.activeTextEditor;
	const text = shadowContext?.activeSelection
		?? (editor && !editor.selection.isEmpty ? editor.document.getText(editor.selection) : undefined);
	if (!text) {
		return {
			kind: 'selection',
			label: 'selection',
			content: '[@selection]\n(nenhuma selecao ativa)'
		};
	}
	return {
		kind: 'selection',
		label: 'selection',
		content: `[@selection]\n${text.slice(0, 12_000)}`
	};
}

async function resolveCodebase(): Promise<ContextAttachment> {
	const tree = await vscode.workspace.findFiles(
		'**/*',
		'{**/node_modules/**,**/.git/**,**/out/**,**/dist/**}',
		200
	);
	const paths = tree.map(uri => vscode.workspace.asRelativePath(uri, false)).sort();
	return {
		kind: 'codebase',
		label: 'codebase',
		content: `[@codebase]\nArquivos do workspace (${paths.length}):\n${paths.join('\n')}`
	};
}

async function pickFileUri(relativePath?: string): Promise<vscode.Uri | undefined> {
	if (relativePath) {
		const folder = vscode.workspace.workspaceFolders?.[0];
		if (!folder) {
			return undefined;
		}
		return vscode.Uri.joinPath(folder.uri, ...relativePath.split(/[\\/]/).filter(Boolean));
	}
	const editor = vscode.window.activeTextEditor;
	return editor?.document.uri;
}

export async function getMentionSuggestions(query: string): Promise<readonly { readonly kind: MentionKind; readonly insert: string; readonly label: string }[]> {
	const q = query.toLowerCase();
	const base = [
		{ kind: 'file' as const, insert: '@file:', label: '@file — arquivo (adicione caminho)' },
		{ kind: 'folder' as const, insert: '@folder:', label: '@folder — pasta' },
		{ kind: 'selection' as const, insert: '@selection', label: '@selection — selecao atual' },
		{ kind: 'terminal' as const, insert: '@terminal', label: '@terminal — ultimo terminal' },
		{ kind: 'codebase' as const, insert: '@codebase', label: '@codebase — arvore do projeto' }
	];
	if (!q) {
		return base;
	}
	const filtered = base.filter(item => item.kind.startsWith(q) || item.insert.includes(q));
	if (filtered.length > 0) {
		return filtered;
	}

	if (q.length >= 1 && vscode.workspace.workspaceFolders?.length) {
		const files = await vscode.workspace.findFiles(
			`**/*${q}*`,
			'{**/node_modules/**,**/.git/**,**/out/**,**/dist/**}',
			15
		);
		return files.map(uri => {
			const rel = vscode.workspace.asRelativePath(uri, false);
			return { kind: 'file' as const, insert: `@file:${rel}`, label: rel };
		});
	}
	return base;
}
