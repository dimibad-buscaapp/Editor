/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export const PRINCY_CHAT_VIEW_ID = 'workbench.view.extension.princyai';
const PRINCY_CHAT_VIEW = PRINCY_CHAT_VIEW_ID;
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
}

async function applyPrincyDefaultChat(): Promise<void> {
	if (!vscode.workspace.getConfiguration('princyai').get<boolean>('ui.defaultChat', true)) {
		return;
	}

	const target = vscode.ConfigurationTarget.Global;

	const chat = vscode.workspace.getConfiguration('chat');
	await chat.update('disableAIFeatures', true, target);
	await chat.update('agentsControl.enabled', 'hidden', target);
	await chat.update('agent.enabled', false, target);
	await chat.update('viewSessions.enabled', false, target);
	await chat.update('unifiedAgentsBar.enabled', false, target);
	await chat.update('restoreLastPanelSession', false, target);
	await chat.update('titleBar.signIn.enabled', false, target);
	await chat.update('agentHost.enabled', false, target);

	const workbench = vscode.workspace.getConfiguration('workbench');
	await workbench.update('secondarySideBar.defaultVisibility', 'visible', target);
	await workbench.update('secondarySideBar.forceMaximized', false, target);
	await workbench.update('layoutControl.enabled', true, target);
	await workbench.update('startupEditor', 'none', target);
	await workbench.update('welcomePage.experimentalOnboarding', false, target);
	await workbench.update('editor.centeredLayoutAutoResize', false, target);
	await workbench.update('activityBar.visible', true, target);

	const files = vscode.workspace.getConfiguration('files');
	await files.update('readonlyInclude', {}, target);
	await files.update('readonlyFromPermissions', false, target);

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

/** No Code Web, chamar :3210 direto no browser aponta para o PC do usuario — usar proxy /princy-api. */
async function migrateWebAgentEndpoint(): Promise<void> {
	if (vscode.env.uiKind !== vscode.UIKind.Web) {
		return;
	}

	const princy = vscode.workspace.getConfiguration('princyai');
	const current = (princy.get<string>('agentEndpoint', '') ?? '').trim();
	const legacy = new Set([
		'',
		'http://127.0.0.1:3210',
		'http://localhost:3210',
		'http://108.181.169.40:3210'
	]);
	const wrongProxyOn3210 = /:3210\/princy-api\/?$/i.test(current);
	const wrongRoot3200 = /^https?:\/\/[^/]+:3200\/?$/i.test(current)
		|| /^https?:\/\/princyai\.com\/?$/i.test(current)
		|| /^https?:\/\/[^/]+:3200$/i.test(current);
	const wrongPublicApi = /^https:\/\/api\.princyai\.com/i.test(current);
	if (!legacy.has(current) && !wrongProxyOn3210 && !wrongRoot3200 && !wrongPublicApi) {
		return;
	}

	await princy.update('useSameOriginApi', true, vscode.ConfigurationTarget.Global);
	// Same-origin relativo: fetch /princy-api/... (Caddy ou proxy :3200 no servidor).
	await princy.update('agentEndpoint', '/princy-api', vscode.ConfigurationTarget.Global);
}

function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function tryCommand(command: string): Promise<boolean> {
	try {
		await vscode.commands.executeCommand(command);
		return true;
	} catch {
		return false;
	}
}

/** Garante barra lateral direita visível sem maximizar (layout Cursor). */
export async function ensurePrincyChatShellVisible(): Promise<void> {
	await tryCommand('workbench.action.restoreAuxiliaryBar');
}

/** Explorer à esquerda + chat dockado à direita (não maximizado). */
export async function ensureCursorLayoutOnStartup(): Promise<void> {
	await tryCommand('workbench.action.restoreAuxiliaryBar');
	await tryCommand('workbench.view.explorer');
	await tryCommand('workbench.action.focusSideBar');
}

/** Abre o container Princy Ai — não chama princyai.chat.focus (evita loop com provider.focus). */
export async function focusPrincyChatPanel(): Promise<void> {
	await tryCommand('workbench.action.restoreAuxiliaryBar');
	const steps = [
		PRINCY_CHAT_VIEW,
		'princyai.open',
		'princyai.chat.focus'
	];
	for (let attempt = 0; attempt < 6; attempt++) {
		for (const command of steps) {
			if (await tryCommand(command)) {
				return;
			}
		}
		await delay(350 + attempt * 400);
	}
}

/** Várias tentativas após o workbench carregar (extensão web pode ativar tarde). */
export function scheduleOpenPrincyChatOnStartup(): void {
	const delays = [400, 1200, 2800, 5500];
	for (const ms of delays) {
		setTimeout(() => {
			if (!vscode.workspace.getConfiguration('princyai').get<boolean>('ui.openChatOnStartup', true)) {
				return;
			}
			void (async () => {
				if (vscode.workspace.getConfiguration('princyai').get<boolean>('chat.dockedRight', true)) {
					await ensureCursorLayoutOnStartup();
				}
				await focusPrincyChatPanel();
			})();
		}, ms);
	}
}
