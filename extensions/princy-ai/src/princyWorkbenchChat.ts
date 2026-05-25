/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { clearAgentEndpointCache } from './agentClient';
import { safeConfigUpdate } from './configSafe';

export const PRINCY_CHAT_VIEW_ID = 'workbench.view.extension.princyai';
const PRINCY_CHAT_VIEW = PRINCY_CHAT_VIEW_ID;
const PLATFORM_CHAT_CONTAINER = 'workbench.panel.chat';

export function shouldOpenChatOnStartup(): boolean {
	return vscode.workspace.getConfiguration('princyai').get<boolean>('ui.openChatOnStartup', false);
}

export function shouldOpenPanelOnStartup(): boolean {
	return vscode.workspace.getConfiguration('princyai').get<boolean>('ui.panelOpenOnStartup', false);
}

export function getPrincySecondarySideBarDefaultVisibility(): 'visible' | 'hidden' {
	return shouldOpenChatOnStartup() ? 'visible' : 'hidden';
}

/** Aplica visibilidade default da barra direita conforme openChatOnStartup. */
export async function applyPrincySecondarySideBarVisibilitySetting(): Promise<void> {
	const target = vscode.ConfigurationTarget.Global;
	const workbench = vscode.workspace.getConfiguration('workbench');
	await safeConfigUpdate('workbench', 'secondarySideBar.defaultVisibility', getPrincySecondarySideBarDefaultVisibility(), target);
	await safeConfigUpdate('workbench', 'secondarySideBar.forceMaximized', false, target);
}

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

	await safeConfigUpdate('chat', 'disableAIFeatures', true, target);
	await safeConfigUpdate('chat', 'agentsControl.enabled', 'hidden', target);
	await safeConfigUpdate('chat', 'agent.enabled', false, target);
	await safeConfigUpdate('chat', 'viewSessions.enabled', false, target);
	await safeConfigUpdate('chat', 'unifiedAgentsBar.enabled', false, target);
	await safeConfigUpdate('chat', 'restoreLastPanelSession', false, target);
	await safeConfigUpdate('chat', 'titleBar.signIn.enabled', false, target);
	await safeConfigUpdate('chat', 'agentHost.enabled', false, target);

	await applyPrincySecondarySideBarVisibilitySetting();
	await safeConfigUpdate('workbench', 'layoutControl.enabled', true, target);
	await safeConfigUpdate('workbench', 'startupEditor', 'none', target);
	await safeConfigUpdate('workbench', 'welcomePage.experimentalOnboarding', false, target);
	await safeConfigUpdate('workbench', 'editor.centeredLayoutAutoResize', false, target);
	await safeConfigUpdate('workbench', 'activityBar.visible', true, target);

	await safeConfigUpdate('files', 'readonlyInclude', {}, target);
	await safeConfigUpdate('files', 'readonlyFromPermissions', false, target);

	const princy = vscode.workspace.getConfiguration('princyai');
	if (princy.get<string>('defaultAgent') !== 'princy') {
		await princy.update('defaultAgent', 'princy', target);
	}
	if (princy.get<string>('ghostText.agent') !== 'princy') {
		await princy.update('ghostText.agent', 'princy', target);
	}

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
export async function migrateWebAgentEndpoint(): Promise<void> {
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
	const wrongRelativeOnly = current === '/princy-api' || current.startsWith('/') && !current.startsWith('//');
	const needsMigrate = legacy.has(current) || wrongProxyOn3210 || wrongRoot3200 || wrongPublicApi || wrongRelativeOnly;
	if (needsMigrate) {
		await princy.update('useSameOriginApi', true, vscode.ConfigurationTarget.Global);
		await princy.update('publicWebOrigin', 'https://princyai.com', vscode.ConfigurationTarget.Global);
		await princy.update('serverBasePath', '/webeditor', vscode.ConfigurationTarget.Global);
		// URL absoluta HTTPS — evita fetch relativo no worker da extensao (offline falso).
		await princy.update('agentEndpoint', 'https://princyai.com/princy-api', vscode.ConfigurationTarget.Global);
	}
	clearAgentEndpointCache();
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
	await tryCommand('princy.unlockEditorLayout');
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
			if (!shouldOpenChatOnStartup()) {
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
