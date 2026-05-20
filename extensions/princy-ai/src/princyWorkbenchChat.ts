/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

const PRINCY_CHAT_VIEW = 'workbench.view.extension.princyai';
const PLATFORM_CHAT_CONTAINER = 'workbench.panel.chat';

/** Desativa UI de chat nativa e abre o painel Princy Ai (estilo Cursor). */
export function registerPrincyDefaultChat(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration('princyai.ui.defaultChat')) {
				void applyPrincyDefaultChat();
			}
		})
	);

	void applyPrincyDefaultChat();
	void migrateWebAgentEndpoint();
	setTimeout(() => void focusPrincyChatPanel(), 400);
	setTimeout(() => void focusPrincyChatPanel(), 1200);
}

async function applyPrincyDefaultChat(): Promise<void> {
	if (!vscode.workspace.getConfiguration('princyai').get<boolean>('ui.defaultChat', true)) {
		return;
	}

	const target = vscode.ConfigurationTarget.Global;

	const chat = vscode.workspace.getConfiguration('chat');
	await chat.update('disableAIFeatures', true, target);
	await chat.update('agent.enabled', false, target);
	await chat.update('viewSessions.enabled', false, target);
	await chat.update('unifiedAgentsBar.enabled', false, target);
	await chat.update('restoreLastPanelSession', false, target);
	await chat.update('titleBar.signIn.enabled', false, target);

	const workbench = vscode.workspace.getConfiguration('workbench');
	await workbench.update('secondarySideBar.defaultVisibility', 'visible', target);
	await workbench.update('startupEditor', 'none', target);

	const princy = vscode.workspace.getConfiguration('princyai');
	await princy.update('defaultAgent', 'deepseek', target);
	await princy.update('ghostText.agent', 'deepseek', target);

	// Fecha o container de chat da plataforma se ainda estiver visível (layout antigo).
	await tryClosePlatformChat();
}

async function tryClosePlatformChat(): Promise<void> {
	const candidates = [
		`workbench.view.${PLATFORM_CHAT_CONTAINER}`,
		'workbench.action.chat.close'
	];

	for (const command of candidates) {
		try {
			await vscode.commands.executeCommand(command);
		} catch {
			// comando pode não existir nesta build
		}
	}
}

/** No Code Web, 127.0.0.1:3210 no browser aponta para o PC do usuario — usar proxy na 3200. */
async function migrateWebAgentEndpoint(): Promise<void> {
	if (vscode.env.uiKind !== vscode.UIKind.Web) {
		return;
	}

	const princy = vscode.workspace.getConfiguration('princyai');
	const current = (princy.get<string>('agentEndpoint', '') ?? '').trim();
	const legacy = new Set(['', 'http://127.0.0.1:3210', 'http://localhost:3210']);
	if (!legacy.has(current)) {
		return;
	}

	await princy.update('agentEndpoint', 'http://127.0.0.1:3200/princy-api', vscode.ConfigurationTarget.Global);
	await princy.update('useSameOriginApi', true, vscode.ConfigurationTarget.Global);
}

export async function focusPrincyChatPanel(): Promise<void> {
	try {
		await vscode.commands.executeCommand(PRINCY_CHAT_VIEW);
		await vscode.commands.executeCommand('princyai.chat.focus');
	} catch {
		// view ainda não registrada
	}
}
