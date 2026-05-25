/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { safeConfigUpdate } from './configSafe';
import { applyPrincySecondarySideBarVisibilitySetting, migrateWebAgentEndpoint, shouldOpenChatOnStartup } from './princyWorkbenchChat';
import { enforcePrincyEditorUnlocked } from './workbenchUi';
import type { PrincyChatViewProvider } from './chatView';

/** Intervalos moderados — so layout/readonly; sem reconnect (evita chat preso em "A ligar"). */
const UNLOCK_FAST_INTERVAL_MS = 120_000;
const UNLOCK_FAST_DURATION_MS = 300_000;
const UNLOCK_SLOW_INTERVAL_MS = 300_000;
const UNLOCK_CONFIG_DEBOUNCE_MS = 2_000;

let unlockConfigDebounceTimer: ReturnType<typeof setTimeout> | undefined;

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
				if (unlockConfigDebounceTimer) {
					clearTimeout(unlockConfigDebounceTimer);
				}
				unlockConfigDebounceTimer = setTimeout(() => {
					unlockConfigDebounceTimer = undefined;
					void runGlobalVisualUnlock(provider, false);
				}, UNLOCK_CONFIG_DEBOUNCE_MS);
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

	await applyPrincySecondarySideBarVisibilitySetting();
	await safeConfigUpdate('files', 'readonlyInclude', {}, target);
	await safeConfigUpdate('files', 'readonlyExclude', {}, target);
	await safeConfigUpdate('files', 'readonlyFromPermissions', false, target);
	await safeConfigUpdate('workbench', 'editor.centeredLayoutAutoResize', false, target);

	const princy = vscode.workspace.getConfiguration('princyai');
	await princy.update('useSameOriginApi', true, target);
	await princy.update('ui.forceVisualUnlock', true, target);
	await princy.update('ui.neverLockLayout', true, target);
	// NUNCA repor agentEndpoint=/princy-api relativo — quebra fetch no worker e marca chat offline.
	await migrateWebAgentEndpoint();

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
	if (showMessage) {
		provider.forceReloadPanel();
	}

	if (showMessage) {
		void vscode.window.showInformationMessage('Princy: visual e layout recarregados (Ctrl+F5 no browser se usar webeditor).');
	}
}
