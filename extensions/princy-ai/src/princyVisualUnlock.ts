/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { applyPrincySecondarySideBarVisibilitySetting, shouldOpenChatOnStartup } from './princyWorkbenchChat';
import { enforcePrincyEditorUnlocked } from './workbenchUi';
import type { PrincyChatViewProvider } from './chatView';

const UNLOCK_FAST_INTERVAL_MS = 8000;
const UNLOCK_FAST_DURATION_MS = 600_000;
const UNLOCK_SLOW_INTERVAL_MS = 30_000;

/** Desbloqueio visual/ediciao global: layout + recarga do painel chat (cache webview). */
export function registerPrincyVisualUnlock(
	context: vscode.ExtensionContext,
	provider: PrincyChatViewProvider
): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('princyai.ui.forceVisualReload', () => {
			void runGlobalVisualUnlock(provider, true);
		}),
		vscode.workspace.onDidChangeConfiguration(event => {
			if (
				event.affectsConfiguration('princyai.ui.forceVisualUnlock')
				|| event.affectsConfiguration('workbench.secondarySideBar.forceMaximized')
				|| event.affectsConfiguration('workbench.secondarySideBar.defaultVisibility')
				|| event.affectsConfiguration('files.readonlyInclude')
			) {
				void runGlobalVisualUnlock(provider, false);
			}
		}),
		vscode.window.onDidChangeWindowState(state => {
			if (state.focused && isForceVisualUnlockEnabled()) {
				void runGlobalVisualUnlock(provider, false);
			}
		})
	);

	void runGlobalVisualUnlock(provider, false);

	const started = Date.now();
	const fastTimer = setInterval(() => {
		if (!isForceVisualUnlockEnabled()) {
			clearInterval(fastTimer);
			return;
		}
		if (Date.now() - started > UNLOCK_FAST_DURATION_MS) {
			clearInterval(fastTimer);
			return;
		}
		void runGlobalVisualUnlock(provider, false);
	}, UNLOCK_FAST_INTERVAL_MS);
	context.subscriptions.push({ dispose: () => clearInterval(fastTimer) });

	// Mantem layout desbloqueado enquanto forceVisualUnlock=true (sessoes longas / cache tardio).
	const slowTimer = setInterval(() => {
		if (!isForceVisualUnlockEnabled()) {
			clearInterval(slowTimer);
			return;
		}
		void runGlobalVisualUnlock(provider, false);
	}, UNLOCK_SLOW_INTERVAL_MS);
	context.subscriptions.push({ dispose: () => clearInterval(slowTimer) });
}

function isForceVisualUnlockEnabled(): boolean {
	const princy = vscode.workspace.getConfiguration('princyai');
	if (princy.get<boolean>('ui.neverLockLayout', true)) {
		return true;
	}
	return princy.get<boolean>('ui.forceVisualUnlock', true);
}

export async function runGlobalVisualUnlock(
	provider: PrincyChatViewProvider,
	showMessage: boolean
): Promise<void> {
	if (!isForceVisualUnlockEnabled()) {
		return;
	}

	const target = vscode.ConfigurationTarget.Global;
	const wb = vscode.workspace.getConfiguration('workbench');
	const files = vscode.workspace.getConfiguration('files');

	await applyPrincySecondarySideBarVisibilitySetting();
	await files.update('readonlyInclude', {}, target);
	await files.update('readonlyExclude', {}, target);
	await files.update('readonlyFromPermissions', false, target);
	await vscode.workspace.getConfiguration('editor').update('centeredLayoutAutoResize', false, target);

	const princy = vscode.workspace.getConfiguration('princyai');
	await princy.update('useSameOriginApi', true, target);
	if (vscode.env.uiKind === vscode.UIKind.Web) {
		const endpoint = (princy.get<string>('agentEndpoint', '') ?? '').trim();
		if (endpoint !== '/princy-api') {
			await princy.update('agentEndpoint', '/princy-api', target);
		}
	}

	await enforcePrincyEditorUnlocked();
	try {
		await vscode.commands.executeCommand('princy.unlockEditorLayout');
	} catch {
		// workbench command only in Code OSS build with contrib princy
	}
	if (shouldOpenChatOnStartup()) {
		try {
			await vscode.commands.executeCommand('workbench.action.restoreAuxiliaryBar');
		} catch {
			// optional
		}
	}
	provider.forceReloadPanel();
	try {
		await vscode.commands.executeCommand('princyai.reconnectBackend');
	} catch {
		// reconnect optional during early activation
	}

	if (showMessage) {
		void vscode.window.showInformationMessage('Princy: visual e layout recarregados (Ctrl+F5 no browser se usar webeditor).');
	}
}
